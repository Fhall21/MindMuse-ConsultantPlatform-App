from __future__ import annotations

from embeddings import EMBEDDING_DIMENSION, TermExtraction, embed_terms


class FakeEmbeddingProvider:
    def embed(self, texts: list[str]) -> list[list[float]]:
        embeddings: list[list[float]] = []
        for index, _text in enumerate(texts, start=1):
            embeddings.append([float(index)] * EMBEDDING_DIMENSION)
        return embeddings


def test_embed_terms_shapes_rows_and_deduplicates() -> None:
    rows = embed_terms(
        [
            TermExtraction(term="Workplace Stress", entity_type="THEME"),
            TermExtraction(term=" workplace   stress ", entity_type="theme"),
            {"term": "PTSD", "entityType": "ISSUE"},
        ],
        consultation_id="consultation-1",
        provider=FakeEmbeddingProvider(),
    )

    assert [row.term for row in rows] == ["workplace stress", "ptsd"]
    assert [row.entity_type for row in rows] == ["THEME", "ISSUE"]
    assert all(row.consultation_id == "consultation-1" for row in rows)
    assert all(len(row.embedding) == EMBEDDING_DIMENSION for row in rows)


def test_embed_terms_rejects_wrong_vector_size() -> None:
    class BadProvider:
        def embed(self, texts: list[str]) -> list[list[float]]:
            return [[0.1] * 3 for _ in texts]

    try:
        embed_terms(
            [TermExtraction(term="Housing insecurity", entity_type="ISSUE")],
            consultation_id="consultation-2",
            provider=BadProvider(),
        )
    except ValueError as exc:
        assert "1536-d embeddings" in str(exc)
    else:  # pragma: no cover - defensive failure branch
        raise AssertionError("Expected embed_terms to reject a non-1536 embedding vector.")
