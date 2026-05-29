from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault("OPENAI_API_KEY", "test-key")

from embeddings import EMBEDDING_DIMENSION  # noqa: E402
from routers import canvas  # noqa: E402
from spatial_layout import (  # noqa: E402
    PADDING,
    UMAP_COMPONENTS,
    UMAP_METRIC,
    UMAP_RANDOM_STATE,
    VIEWPORT_H,
    VIEWPORT_W,
    compute_spatial_layout,
)


@dataclass(frozen=True)
class Node:
    id: str
    text: str


class FakeProvider:
    def __init__(self) -> None:
        self.calls: list[list[str]] = []

    def embed(self, texts: list[str]) -> list[list[float]]:
        self.calls.append(texts)
        vectors: list[list[float]] = []
        for index, _text in enumerate(texts, start=1):
            vector = [0.0] * EMBEDDING_DIMENSION
            vector[0] = float(index)
            vector[1] = float(index % 3)
            vectors.append(vector)
        return vectors


class FakeReducer:
    last_kwargs: dict[str, object] | None = None

    def __init__(self, **kwargs) -> None:
        FakeReducer.last_kwargs = kwargs

    def fit_transform(self, matrix):
        return np.asarray([[row[0], row[1]] for row in matrix], dtype=np.float32)


class RaisingReducer:
    def __init__(self, **_kwargs) -> None:
        pass

    def fit_transform(self, _matrix):
        raise RuntimeError("umap unavailable")


class NaNReducer:
    def __init__(self, **_kwargs) -> None:
        pass

    def fit_transform(self, _matrix):
        return np.asarray([[float("nan"), 0], [float("inf"), 1], [2, float("-inf")]], dtype=np.float32)


class FakeConnection:
    def __init__(self, store: dict[str, list[float]]) -> None:
        self.store = store

    def execute(self, statement):
        statement_name = statement.__class__.__name__.lower()
        if "select" in statement_name:
            return list(self.store.items())
        compiled = statement.compile()
        params = compiled.params
        text_hash = str(params["text_hash"])
        self.store.setdefault(text_hash, list(params["embedding"]))
        return []


class FakeBegin:
    def __init__(self, store: dict[str, list[float]]) -> None:
        self.conn = FakeConnection(store)

    def __enter__(self):
        return self.conn

    def __exit__(self, *_args):
        return False


class FakeEngine:
    def __init__(self) -> None:
        self.store: dict[str, list[float]] = {}

    def begin(self):
        return FakeBegin(self.store)


def nodes(count: int) -> list[Node]:
    return [Node(id=f"node-{index}", text=f"theme text {index}") for index in range(count)]


def node_payloads(count: int) -> list[dict[str, str]]:
    return [{"id": f"node-{index}", "text": f"theme text {index}"} for index in range(count)]


def assert_positions_in_viewport(positions: dict[str, dict[str, float]]) -> None:
    for position in positions.values():
        assert 0 <= position["x"] <= VIEWPORT_W
        assert 0 <= position["y"] <= VIEWPORT_H


def test_rejects_fewer_than_3_nodes() -> None:
    with pytest.raises(ValueError, match="At least 3 nodes required"):
        compute_spatial_layout(nodes(2), FakeEngine(), embedding_provider=FakeProvider())


def test_rejects_more_than_200_nodes() -> None:
    with pytest.raises(ValueError, match="Maximum 200 nodes"):
        compute_spatial_layout(nodes(201), FakeEngine(), embedding_provider=FakeProvider())


def test_returns_positions_for_valid_input() -> None:
    result = compute_spatial_layout(
        nodes(10),
        FakeEngine(),
        embedding_provider=FakeProvider(),
        reducer_factory=FakeReducer,
        name_frames=False,
    )

    assert set(result.positions) == {f"node-{index}" for index in range(10)}
    assert_positions_in_viewport(result.positions)
    assert result.cache_stats.hits == 0
    assert result.cache_stats.misses == 10
    assert len(result.suggested_frames) == 2
    assert all(frame.node_ids for frame in result.suggested_frames)
    assert all(frame.width >= 320 for frame in result.suggested_frames)
    assert all(frame.height >= 240 for frame in result.suggested_frames)
    assert FakeReducer.last_kwargs == {
        "n_components": UMAP_COMPONENTS,
        "random_state": UMAP_RANDOM_STATE,
        "n_neighbors": 9,
        "metric": UMAP_METRIC,
        "init": "random",
    }


def test_cache_hit_skips_openai_on_second_call() -> None:
    engine = FakeEngine()
    provider = FakeProvider()

    compute_spatial_layout(
        nodes(4),
        engine,
        embedding_provider=provider,
        reducer_factory=FakeReducer,
        name_frames=False,
    )
    second = compute_spatial_layout(
        nodes(4),
        engine,
        embedding_provider=provider,
        reducer_factory=FakeReducer,
        name_frames=False,
    )

    assert len(provider.calls) == 1
    assert second.cache_stats.hits == 4
    assert second.cache_stats.misses == 0


def test_umap_failure_falls_back_to_grid() -> None:
    result = compute_spatial_layout(
        nodes(5),
        FakeEngine(),
        embedding_provider=FakeProvider(),
        reducer_factory=RaisingReducer,
        name_frames=False,
    )

    assert set(result.positions) == {f"node-{index}" for index in range(5)}
    assert_positions_in_viewport(result.positions)


def test_nan_positions_are_clamped() -> None:
    result = compute_spatial_layout(
        nodes(3),
        FakeEngine(),
        embedding_provider=FakeProvider(),
        reducer_factory=NaNReducer,
        name_frames=False,
    )

    assert_positions_in_viewport(result.positions)
    assert result.positions["node-0"]["x"] == PADDING


def test_router_maps_rate_limit_to_503() -> None:
    with patch.object(canvas.openai, "RateLimitError", RuntimeError):
        with patch.object(canvas, "_get_db_engine", return_value=FakeEngine()):
            with patch.object(canvas, "compute_spatial_layout", side_effect=RuntimeError("rate limited")):
                with pytest.raises(canvas.HTTPException) as exc:
                    canvas.spatial_layout(
                        canvas.SpatialLayoutRequest(roundId="round-1", nodes=node_payloads(3))
                    )
    assert exc.value.status_code == 503


def test_router_retries_rate_limit_three_times() -> None:
    class RateLimitedProvider:
        def __init__(self) -> None:
            self.calls = 0

        def embed(self, _texts: list[str]) -> list[list[float]]:
            self.calls += 1
            raise RuntimeError("rate limited")

    provider = RateLimitedProvider()
    with patch("spatial_layout.openai.RateLimitError", RuntimeError):
        with pytest.raises(RuntimeError, match="rate limited"):
            compute_spatial_layout(
                nodes(3),
                FakeEngine(),
                embedding_provider=provider,
                sleep_fn=lambda _seconds: None,
                name_frames=False,
            )
    assert provider.calls == 3


def test_cache_write_unique_conflict_does_not_fail() -> None:
    class ConflictConnection(FakeConnection):
        def execute(self, statement):
            statement_name = statement.__class__.__name__.lower()
            if "insert" in statement_name:
                return []
            return super().execute(statement)

    class ConflictBegin(FakeBegin):
        def __enter__(self):
            return ConflictConnection(self.conn.store)

    class ConflictEngine(FakeEngine):
        def begin(self):
            return ConflictBegin(self.store)

    result = compute_spatial_layout(
        nodes(3),
        ConflictEngine(),
        embedding_provider=FakeProvider(),
        reducer_factory=FakeReducer,
        name_frames=False,
    )

    assert set(result.positions) == {f"node-{index}" for index in range(3)}


def test_router_maps_timeout_to_504() -> None:
    class TimeoutErrorForTest(Exception):
        pass

    with patch.object(canvas, "_get_db_engine", return_value=FakeEngine()):
        with patch.object(canvas, "compute_spatial_layout", side_effect=RuntimeError("rate limited")):
            with patch.object(canvas, "is_timeout_error", return_value=True):
                with pytest.raises(canvas.HTTPException) as exc:
                    canvas.spatial_layout(
                        canvas.SpatialLayoutRequest(roundId="round-1", nodes=node_payloads(3))
                    )
    assert exc.value.status_code == 504


def test_fastapi_app_imports_canvas_router() -> None:
    import main

    paths = {route.path for route in main.app.routes}
    assert "/canvas/spatial-layout" in paths
    client = TestClient(main.app)
    with patch.object(canvas, "_get_db_engine", return_value=FakeEngine()):
        with patch.object(canvas, "compute_spatial_layout") as compute:
            compute.return_value = MagicMock(
                positions={"node-1": {"x": 80.0, "y": 80.0}},
                cache_stats=MagicMock(hits=0, misses=3),
                suggested_frames=[],
            )
            response = client.post(
                "/canvas/spatial-layout",
                json={
                    "roundId": "round-1",
                    "nodes": [
                        {"id": "node-1", "text": "one"},
                        {"id": "node-2", "text": "two"},
                        {"id": "node-3", "text": "three"},
                    ],
                },
            )
    assert response.status_code == 200
