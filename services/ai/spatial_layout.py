from __future__ import annotations

import hashlib
import json
import logging
import math
import time
import uuid
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Any, Protocol

import httpx
import numpy as np
import openai
from embeddings import EMBEDDING_DIMENSION, OpenAIEmbeddingProvider
from sqlalchemy import Column, DateTime, Float, MetaData, String, Table, func, select
from sqlalchemy.dialects.postgresql import ARRAY, insert as pg_insert

logger = logging.getLogger(__name__)

VIEWPORT_W = 5000.0
VIEWPORT_H = 4000.0
PADDING = 80.0
MIN_NODES = 3
MAX_NODES = 200
MAX_TEXT_CHARS = 8000
UMAP_COMPONENTS = 2
UMAP_RANDOM_STATE = 42
UMAP_METRIC = "cosine"

_metadata = MetaData()
canvas_node_embeddings = Table(
    "canvas_node_embeddings",
    _metadata,
    Column("id", String, primary_key=True),
    Column("text_hash", String, nullable=False),
    Column("embedding", ARRAY(Float), nullable=False),
    Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
)


class NodeLike(Protocol):
    id: str
    text: str


class EmbeddingProvider(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]:
        ...


@dataclass(frozen=True)
class CacheStats:
    hits: int
    misses: int


@dataclass(frozen=True)
class SuggestedFrame:
    id: str
    name: str
    node_ids: list[str]
    x: float
    y: float
    width: float
    height: float
    color: str


@dataclass(frozen=True)
class SpatialLayoutComputation:
    positions: dict[str, dict[str, float]]
    cache_stats: CacheStats
    suggested_frames: list[SuggestedFrame]


def compute_spatial_layout(
    nodes: Sequence[NodeLike],
    db_engine: Any,
    *,
    round_id: str | None = None,
    embedding_provider: EmbeddingProvider | None = None,
    reducer_factory: Callable[..., Any] | None = None,
    sleep_fn: Callable[[float], None] = time.sleep,
    name_frames: bool = True,
) -> SpatialLayoutComputation:
    node_count = len(nodes)
    if node_count < MIN_NODES:
        raise ValueError("At least 3 nodes required for spatial layout")
    if node_count > MAX_NODES:
        raise ValueError("Maximum 200 nodes allowed for spatial layout")

    logger.info(
        "spatial_layout.request",
        extra={"round_id": round_id, "node_count": node_count},
    )

    texts = [_truncate_text(node.text, round_id=round_id) for node in nodes]
    text_hashes = [_hash_text(text) for text in texts]

    with db_engine.begin() as conn:
        cached = _load_cached_embeddings(conn, text_hashes)
        misses = [index for index, text_hash in enumerate(text_hashes) if text_hash not in cached]

        if misses:
            miss_texts = [texts[index] for index in misses]
            started = time.monotonic()
            vectors = _embed_with_retry(
                miss_texts,
                embedding_provider or OpenAIEmbeddingProvider(),
                round_id=round_id,
                sleep_fn=sleep_fn,
            )
            logger.info(
                "spatial_layout.embed_complete",
                extra={
                    "round_id": round_id,
                    "duration_ms": int((time.monotonic() - started) * 1000),
                    "tokens_approx": sum(len(text) for text in miss_texts) // 4,
                },
            )

            if len(vectors) != len(misses):
                raise ValueError("Embedding provider returned a different number of vectors than inputs.")

            for index, vector in zip(misses, vectors):
                _validate_embedding(vector)
                cached[text_hashes[index]] = vector
                _save_cached_embedding(conn, text_hashes[index], vector)

    logger.info(
        "spatial_layout.cache",
        extra={"round_id": round_id, "hits": node_count - len(misses), "misses": len(misses)},
    )

    matrix = np.asarray([cached[text_hash] for text_hash in text_hashes], dtype=np.float32)
    started = time.monotonic()
    coords = _reduce_embeddings(matrix, node_count, reducer_factory=reducer_factory, round_id=round_id)
    logger.info(
        "spatial_layout.umap_complete",
        extra={"round_id": round_id, "duration_ms": int((time.monotonic() - started) * 1000)},
    )

    positions = _normalise_to_viewport(coords, nodes)
    suggested_frames = _suggest_frames(nodes, positions)
    if name_frames and suggested_frames:
        suggested_frames = _name_suggested_frames(suggested_frames, nodes, round_id=round_id)

    return SpatialLayoutComputation(
        positions=positions,
        cache_stats=CacheStats(hits=node_count - len(misses), misses=len(misses)),
        suggested_frames=suggested_frames,
    )


def _truncate_text(text: str, *, round_id: str | None) -> str:
    if len(text) <= MAX_TEXT_CHARS:
        return text
    logger.warning(
        "spatial_layout.text_truncated",
        extra={"round_id": round_id, "original_chars": len(text), "max_chars": MAX_TEXT_CHARS},
    )
    return text[:MAX_TEXT_CHARS]


def _hash_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _load_cached_embeddings(conn: Any, text_hashes: Sequence[str]) -> dict[str, list[float]]:
    if not text_hashes:
        return {}
    rows = conn.execute(
        select(canvas_node_embeddings.c.text_hash, canvas_node_embeddings.c.embedding).where(
            canvas_node_embeddings.c.text_hash.in_(list(text_hashes))
        )
    )
    cached: dict[str, list[float]] = {}
    for row in rows:
        text_hash = str(row[0])
        embedding = [float(value) for value in row[1]]
        if len(embedding) == EMBEDDING_DIMENSION:
            cached[text_hash] = embedding
    return cached


def _save_cached_embedding(conn: Any, text_hash: str, embedding: Sequence[float]) -> None:
    stmt = (
        pg_insert(canvas_node_embeddings)
        .values(
            id=str(uuid.uuid4()),
            text_hash=text_hash,
            embedding=[float(value) for value in embedding],
        )
        .on_conflict_do_nothing(index_elements=[canvas_node_embeddings.c.text_hash])
    )
    conn.execute(stmt)


def _embed_with_retry(
    texts: list[str],
    provider: EmbeddingProvider,
    *,
    round_id: str | None,
    sleep_fn: Callable[[float], None],
) -> list[list[float]]:
    for attempt in range(3):
        try:
            return provider.embed(texts)
        except openai.RateLimitError:
            if attempt == 2:
                raise
            logger.warning(
                "spatial_layout.openai_retry",
                extra={"round_id": round_id, "attempt": attempt + 1},
            )
            sleep_fn(float(2**attempt))
    raise RuntimeError("Embedding retry loop exited unexpectedly")


def _validate_embedding(vector: Sequence[float]) -> None:
    if len(vector) != EMBEDDING_DIMENSION:
        raise ValueError(f"Expected {EMBEDDING_DIMENSION}-d embeddings")


def _reduce_embeddings(
    matrix: np.ndarray,
    node_count: int,
    *,
    reducer_factory: Callable[..., Any] | None,
    round_id: str | None,
) -> np.ndarray:
    try:
        if reducer_factory is None:
            from umap import UMAP

            reducer_factory = UMAP
        reducer = reducer_factory(
            n_components=UMAP_COMPONENTS,
            random_state=UMAP_RANDOM_STATE,
            n_neighbors=min(15, node_count - 1),
            metric=UMAP_METRIC,
            init="random",
        )
        coords = np.asarray(reducer.fit_transform(matrix), dtype=np.float32)
        if coords.shape != (node_count, UMAP_COMPONENTS):
            raise ValueError(f"UMAP returned shape {coords.shape}, expected {(node_count, UMAP_COMPONENTS)}")
        if not np.isfinite(coords).all():
            raise ValueError("UMAP returned non-finite coordinates")
        return coords
    except Exception as exc:
        logger.error(
            "spatial_layout.umap_failed",
            extra={"round_id": round_id, "error": str(exc), "node_count": node_count},
        )
        return _grid_fallback_coords(node_count)


def _grid_fallback_coords(node_count: int) -> np.ndarray:
    cols = math.ceil(math.sqrt(node_count))
    rows = math.ceil(node_count / cols)
    x_step = 1.0 / max(cols - 1, 1)
    y_step = 1.0 / max(rows - 1, 1)
    coords: list[list[float]] = []
    for index in range(node_count):
        col = index % cols
        row = index // cols
        coords.append([col * x_step, row * y_step])
    return np.asarray(coords, dtype=np.float32)


def _normalise_to_viewport(coords: np.ndarray, nodes: Sequence[NodeLike]) -> dict[str, dict[str, float]]:
    coords = np.asarray(coords, dtype=np.float32)
    finite_x = coords[:, 0][np.isfinite(coords[:, 0])]
    finite_y = coords[:, 1][np.isfinite(coords[:, 1])]

    min_x = float(finite_x.min()) if finite_x.size else 0.0
    max_x = float(finite_x.max()) if finite_x.size else 1.0
    min_y = float(finite_y.min()) if finite_y.size else 0.0
    max_y = float(finite_y.max()) if finite_y.size else 1.0
    span_x = max(max_x - min_x, 1e-9)
    span_y = max(max_y - min_y, 1e-9)
    usable_w = VIEWPORT_W - 2 * PADDING
    usable_h = VIEWPORT_H - 2 * PADDING

    result: dict[str, dict[str, float]] = {}
    for node, coord in zip(nodes, coords):
        raw_x = float(coord[0])
        raw_y = float(coord[1])
        if not math.isfinite(raw_x):
            x = PADDING
        else:
            x = PADDING + ((raw_x - min_x) / span_x) * usable_w
        if not math.isfinite(raw_y):
            y = PADDING
        else:
            y = PADDING + ((raw_y - min_y) / span_y) * usable_h
        result[node.id] = {
            "x": float(min(max(x, 0.0), VIEWPORT_W)),
            "y": float(min(max(y, 0.0), VIEWPORT_H)),
        }
    return result


def _suggest_frames(
    nodes: Sequence[NodeLike],
    positions: dict[str, dict[str, float]],
) -> list[SuggestedFrame]:
    node_count = len(nodes)
    cluster_count = _suggested_cluster_count(node_count)
    if cluster_count <= 1:
        clusters = [list(nodes)]
    else:
        try:
            from sklearn.cluster import KMeans

            matrix = np.asarray(
                [[positions[node.id]["x"], positions[node.id]["y"]] for node in nodes],
                dtype=np.float32,
            )
            labels = KMeans(n_clusters=cluster_count, random_state=42, n_init=10).fit_predict(matrix)
            clusters = [
                [node for node, label in zip(nodes, labels) if int(label) == cluster_index]
                for cluster_index in range(cluster_count)
            ]
            clusters = [cluster for cluster in clusters if cluster]
        except Exception as exc:
            logger.warning("spatial_layout.frame_cluster_failed", extra={"error": str(exc)})
            clusters = [list(nodes)]

    frames: list[SuggestedFrame] = []
    colors = ["blue", "green", "purple", "amber", "rose", "slate"]
    for index, cluster in enumerate(clusters):
        cluster_positions = [positions[node.id] for node in cluster]
        min_x = min(position["x"] for position in cluster_positions)
        max_x = max(position["x"] for position in cluster_positions)
        min_y = min(position["y"] for position in cluster_positions)
        max_y = max(position["y"] for position in cluster_positions)
        frame_padding = 120.0
        x = max(0.0, min_x - frame_padding)
        y = max(0.0, min_y - frame_padding)
        width = min(VIEWPORT_W - x, max(320.0, (max_x - min_x) + frame_padding * 2))
        height = min(VIEWPORT_H - y, max(240.0, (max_y - min_y) + frame_padding * 2))
        frames.append(
            SuggestedFrame(
                id=f"suggested-frame-{index + 1}",
                name=f"Cluster {index + 1}",
                node_ids=[node.id for node in cluster],
                x=float(x),
                y=float(y),
                width=float(width),
                height=float(height),
                color=colors[index % len(colors)],
            )
        )
    return frames


def _suggested_cluster_count(node_count: int) -> int:
    if node_count < 6:
        return 1
    if node_count < 12:
        return 2
    if node_count < 24:
        return 3
    return min(6, max(3, round(math.sqrt(node_count / 2))))


def _name_suggested_frames(
    frames: list[SuggestedFrame],
    nodes: Sequence[NodeLike],
    *,
    round_id: str | None,
) -> list[SuggestedFrame]:
    try:
        from core.config import settings
        from core.openai_client import get_client

        if not settings.openai_api_key:
            return frames
        node_text_by_id = {node.id: node.text for node in nodes}
        cluster_lines = []
        for frame in frames:
            snippets = [
                f"- {node_id}: {_compact_text(node_text_by_id.get(node_id, ''), 180)}"
                for node_id in frame.node_ids[:8]
            ]
            cluster_lines.append(f"{frame.id}\\n" + "\\n".join(snippets))

        system_prompt = (
            "You are helping a consultant name spatial clusters on a visual canvas (2D layout with x and y coordinates holding text groups).\\n\\n"
            "Each cluster will become a suggested frame (an element which contains text snippets). Name the shared concern using only the node text.\\n"
            "Requirements:\\n"
            "- Keep each name concise: 2-6 words.\\n"
            "- Use Australian English.\\n"
            "- Do not invent evidence, recommendations, or management actions.\\n"
            "- If a cluster is broad, name the shared concern without flattening nuance.\\n\\n"
            "Return JSON with: frames: [{ id: string, name: string }]."
        )
        completion = get_client().chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "\\n\\n".join(cluster_lines)},
            ],
            response_format={"type": "json_object"},
        )
        parsed = json.loads(completion.choices[0].message.content or "{}")
        names = {
            str(item.get("id")): _compact_name(str(item.get("name", "")))
            for item in parsed.get("frames", [])
            if isinstance(item, dict)
        }
        return [
            SuggestedFrame(
                id=frame.id,
                name=names.get(frame.id) or frame.name,
                node_ids=frame.node_ids,
                x=frame.x,
                y=frame.y,
                width=frame.width,
                height=frame.height,
                color=frame.color,
            )
            for frame in frames
        ]
    except Exception as exc:
        logger.warning(
            "spatial_layout.frame_naming_failed",
            extra={"round_id": round_id, "error": str(exc)},
        )
        return frames


def _compact_text(value: str, max_chars: int) -> str:
    compacted = " ".join(value.strip().split())
    if len(compacted) <= max_chars:
        return compacted
    return compacted[: max_chars - 3].rstrip() + "..."


def _compact_name(value: str) -> str:
    words = " ".join(value.strip().split()).split()
    if not words:
        return ""
    return " ".join(words[:6])


def is_timeout_error(exc: BaseException) -> bool:
    timeout_cls = getattr(openai, "APITimeoutError", None)
    return isinstance(exc, httpx.TimeoutException) or (
        timeout_cls is not None and isinstance(exc, timeout_cls)
    )
