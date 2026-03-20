from __future__ import annotations

import pytest

pytest.importorskip("hdbscan")
pytest.importorskip("sklearn")

from clustering import cluster_embeddings, cluster_round, cluster_round_result
from embeddings import TermEmbedding


class FakeSession:
    def __init__(self, rows):
        self.rows = rows
        self.params = None

    def execute(self, _query, params):
        self.params = params
        return self.rows


def test_cluster_embeddings_keeps_noise_in_memberships_only() -> None:
    rows = [
        TermEmbedding("c1", "anxiety", "ISSUE", [0.00, 0.00]),
        TermEmbedding("c2", "stress", "ISSUE", [0.04, 0.01]),
        TermEmbedding("c3", "burnout", "ISSUE", [0.01, 0.05]),
        TermEmbedding("c4", "orchard", "OTHER", [8.0, 8.0]),
    ]

    result = cluster_embeddings(rows, min_cluster_size=3)

    assert len(result.clusters) == 1
    assert result.clusters[0].cluster_id == 0
    assert len(result.clusters[0].representative_terms) <= 5
    assert result.clusters[0].consultation_count == 3

    memberships = {(item.term, item.consultation_id): item for item in result.memberships}
    assert memberships[("orchard", "c4")].cluster_id == -1
    assert memberships[("orchard", "c4")].membership_probability == 0.0
    assert all(0.0 <= item.membership_probability <= 1.0 for item in result.memberships)


def test_cluster_round_queries_the_round_scope() -> None:
    session = FakeSession(
        [
            {
                "consultation_id": "c1",
                "term": "anxiety",
                "entity_type": "ISSUE",
                "embedding": [0.00, 0.00],
            },
            {
                "consultation_id": "c2",
                "term": "stress",
                "entity_type": "ISSUE",
                "embedding": [0.04, 0.01],
            },
            {
                "consultation_id": "c3",
                "term": "burnout",
                "entity_type": "ISSUE",
                "embedding": [0.01, 0.05],
            },
            {
                "consultation_id": "c4",
                "term": "orchard",
                "entity_type": "OTHER",
                "embedding": [8.0, 8.0],
            },
        ]
    )

    clusters = cluster_round("round-123", session)
    result = cluster_round_result("round-123", session)

    assert session.params == {"round_id": "round-123"}
    assert len(clusters) == 1
    assert result.memberships[-1].cluster_id == -1
