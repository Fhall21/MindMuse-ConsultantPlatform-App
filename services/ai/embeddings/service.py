from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Mapping, Protocol

EMBEDDING_DIMENSION = 1536
DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small"


@dataclass
class TermExtraction:
    term: str
    entity_type: str
    confidence: float | None = None
    char_start: int | None = None
    char_end: int | None = None
    source_span: str | None = None


@dataclass
class TermEmbedding:
    consultation_id: str
    term: str
    entity_type: str
    embedding: list[float]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class EmbeddingProvider(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]:
        """Return one embedding vector per input text."""


class OpenAIEmbeddingProvider:
    def __init__(self, model: str = DEFAULT_EMBEDDING_MODEL):
        self.model = model

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        from core.openai_client import get_client

        response = get_client().embeddings.create(model=self.model, input=texts)
        embeddings: list[list[float]] = []
        for item in response.data:
            embeddings.append(_validate_embedding(item.embedding, model=self.model))
        return embeddings


def embed_terms(
    terms: list[TermExtraction | Mapping[str, Any]],
    consultation_id: str,
    provider: EmbeddingProvider | None = None,
) -> list[TermEmbedding]:
    """Embed extracted terms and return rows ready for DB insert."""

    prepared_terms = _unique_terms(terms)
    if not prepared_terms:
        return []

    embedder = provider or OpenAIEmbeddingProvider()
    vectors = embedder.embed([term.term for term in prepared_terms])
    if len(vectors) != len(prepared_terms):
        raise ValueError("Embedding provider returned a different number of vectors than inputs.")

    rows: list[TermEmbedding] = []
    for term, vector in zip(prepared_terms, vectors):
        rows.append(
            TermEmbedding(
                consultation_id=consultation_id,
                term=term.term,
                entity_type=term.entity_type,
                embedding=_validate_embedding(vector),
            )
        )
    return rows


def _unique_terms(terms: list[TermExtraction | Mapping[str, Any]]) -> list[TermExtraction]:
    unique_terms: dict[tuple[str, str], TermExtraction] = {}
    for item in terms:
        prepared = _coerce_term(item)
        key = (prepared.term, prepared.entity_type)
        unique_terms.setdefault(key, prepared)
    return list(unique_terms.values())


def _coerce_term(item: TermExtraction | Mapping[str, Any]) -> TermExtraction:
    if isinstance(item, TermExtraction):
        return TermExtraction(
            term=_canonical_term(item.term),
            entity_type=_entity_type(item.entity_type),
            confidence=item.confidence,
            char_start=item.char_start,
            char_end=item.char_end,
            source_span=item.source_span,
        )

    raw_term = item.get("term")
    raw_entity_type = item.get("entity_type") or item.get("entityType") or "OTHER"
    if raw_term is None:
        raise ValueError("Each extracted term must include a `term` value.")

    return TermExtraction(
        term=_canonical_term(str(raw_term)),
        entity_type=_entity_type(str(raw_entity_type)),
        confidence=_optional_float(item.get("confidence")),
        char_start=_optional_int(item.get("char_start") or item.get("charStart")),
        char_end=_optional_int(item.get("char_end") or item.get("charEnd")),
        source_span=_optional_str(item.get("source_span") or item.get("sourceSpan")),
    )


def _canonical_term(text: str) -> str:
    canonical = " ".join(text.strip().lower().split())
    if not canonical:
        raise ValueError("Extracted terms must not be blank.")
    return canonical


def _entity_type(value: str) -> str:
    entity_type = value.strip().upper()
    return entity_type or "OTHER"


def _optional_float(value: Any) -> float | None:
    if value is None:
        return None
    return float(value)


def _optional_int(value: Any) -> int | None:
    if value is None:
        return None
    return int(value)


def _optional_str(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


def _validate_embedding(values: Any, model: str | None = None) -> list[float]:
    embedding = [float(value) for value in values]
    if len(embedding) != EMBEDDING_DIMENSION:
        detail = f" for model {model}" if model else ""
        raise ValueError(
            f"Expected {EMBEDDING_DIMENSION}-d embeddings{detail}, received {len(embedding)} values."
        )
    return embedding
