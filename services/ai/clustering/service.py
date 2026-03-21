from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Iterable, Mapping, cast, TYPE_CHECKING

import numpy as np

from embeddings import TermEmbedding

if TYPE_CHECKING:
    from sqlalchemy.orm import Session
else:  # pragma: no cover - typing-only import
    Session = Any


ROUND_EMBEDDINGS_QUERY = """
SELECT
    te.meeting_id,
    te.term,
    te.entity_type,
    te.embedding
FROM term_embeddings AS te
INNER JOIN meetings AS m
    ON m.id = te.meeting_id
WHERE m.consultation_id = :consultation_id
ORDER BY te.meeting_id, te.term
"""


@dataclass
class TermClusterMembership:
    term: str
    meeting_id: str
    cluster_id: int
    membership_probability: float


@dataclass
class TermCluster:
    cluster_id: int
    label: str
    representative_terms: list[str]
    all_terms: list[str]
    meeting_count: int


@dataclass
class ClusterRoundResult:
    clusters: list[TermCluster]
    memberships: list[TermClusterMembership]


def cluster_round(consultation_id: str, db: Session) -> list[TermCluster]:
    """
    Load all term embeddings for meetings in consultation_id,
    run HDBSCAN, return TermCluster[] matching types/analytics.ts.
    """

    return cluster_round_result(consultation_id, db).clusters


def cluster_round_result(consultation_id: str, db: Session) -> ClusterRoundResult:
    rows = _load_round_embeddings(consultation_id, db)
    return cluster_embeddings(rows)


def cluster_embeddings(
    rows: list[TermEmbedding],
    *,
    min_cluster_size: int = 3,
    min_samples: int = 1,
    metric: str = "euclidean",
    cluster_selection_method: str = "eom",
) -> ClusterRoundResult:
    if not rows:
        return ClusterRoundResult(clusters=[], memberships=[])

    if len(rows) < min_cluster_size:
        return ClusterRoundResult(clusters=[], memberships=_noise_memberships(rows))

    from hdbscan import HDBSCAN, all_points_membership_vectors

    matrix = np.asarray([row.embedding for row in rows], dtype=float)
    clusterer = HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
        metric=metric,
        cluster_selection_method=cluster_selection_method,
        prediction_data=True,
    )
    labels = clusterer.fit_predict(matrix)
    soft_membership_vectors = all_points_membership_vectors(clusterer)

    memberships: list[TermClusterMembership] = []
    grouped_indexes: dict[int, list[int]] = defaultdict(list)
    for index, row in enumerate(rows):
        label = int(labels[index])
        probability = _membership_probability(label, index, clusterer.probabilities_, soft_membership_vectors)
        memberships.append(
            TermClusterMembership(
                term=row.term,
                meeting_id=row.meeting_id,
                cluster_id=label,
                membership_probability=probability,
            )
        )
        if label >= 0:
            grouped_indexes[label].append(index)

    clusters: list[TermCluster] = []
    for cluster_id in sorted(grouped_indexes):
        indexes = grouped_indexes[cluster_id]
        representative_terms, ranked_terms = _rank_cluster_terms(rows, indexes)
        cluster_rows = [rows[index] for index in indexes]
        clusters.append(
            TermCluster(
                cluster_id=cluster_id,
                label=_cluster_label(representative_terms),
                representative_terms=representative_terms,
                all_terms=ranked_terms,
                meeting_count=len({row.meeting_id for row in cluster_rows}),
            )
        )

    return ClusterRoundResult(clusters=clusters, memberships=memberships)


def _load_round_embeddings(consultation_id: str, db: Session) -> list[TermEmbedding]:
    try:
        from sqlalchemy import text
    except ModuleNotFoundError:
        query = ROUND_EMBEDDINGS_QUERY
    else:
        query = text(ROUND_EMBEDDINGS_QUERY)

    result = db.execute(cast(Any, query), {"consultation_id": consultation_id})
    records = _result_records(result)
    rows: list[TermEmbedding] = []
    for record in records:
        rows.append(
            TermEmbedding(
                meeting_id=str(record["meeting_id"]),
                term=str(record["term"]),
                entity_type=str(record["entity_type"]),
                embedding=_coerce_embedding(record["embedding"]),
            )
        )
    return rows


def _result_records(result: Any) -> list[Mapping[str, Any]]:
    if hasattr(result, "mappings"):
        return list(result.mappings())

    if isinstance(result, Iterable):
        records: list[Mapping[str, Any]] = []
        for row in result:
            if isinstance(row, Mapping):
                records.append(row)
            elif hasattr(row, "_mapping"):
                records.append(row._mapping)
            else:
                raise TypeError("Unsupported round embedding row type returned by the DB session.")
        return records

    raise TypeError("Unsupported DB execute() result; expected iterable rows or a mappings() result.")


def _coerce_embedding(value: Any) -> list[float]:
    if hasattr(value, "tolist"):
        return [float(item) for item in value.tolist()]
    if isinstance(value, str):
        stripped = value.strip().strip("[]")
        if not stripped:
            return []
        return [float(item.strip()) for item in stripped.split(",") if item.strip()]
    return [float(item) for item in value]


def _noise_memberships(rows: list[TermEmbedding]) -> list[TermClusterMembership]:
    return [
        TermClusterMembership(
            term=row.term,
            meeting_id=row.meeting_id,
            cluster_id=-1,
            membership_probability=0.0,
        )
        for row in rows
    ]


def _membership_probability(
    label: int,
    index: int,
    raw_probabilities: np.ndarray,
    soft_membership_vectors: np.ndarray,
) -> float:
    if label < 0:
        return 0.0

    probability = float(raw_probabilities[index]) if len(raw_probabilities) > index else 0.0
    if soft_membership_vectors.ndim == 2 and soft_membership_vectors.shape[0] > index and soft_membership_vectors.shape[1] > label:
        probability = float(soft_membership_vectors[index][label])
    return max(0.0, min(1.0, probability))


def _rank_cluster_terms(rows: list[TermEmbedding], indexes: list[int]) -> tuple[list[str], list[str]]:
    from sklearn.feature_extraction.text import TfidfVectorizer

    corpus = [row.term for row in rows]
    vectorizer = TfidfVectorizer(
        tokenizer=lambda term: [term],
        preprocessor=lambda term: term,
        lowercase=False,
        norm=None,
    )
    matrix = vectorizer.fit_transform(corpus)
    feature_indexes = {term: index for index, term in enumerate(vectorizer.get_feature_names_out())}

    scores: dict[str, float] = defaultdict(float)
    for row_index in indexes:
        term = rows[row_index].term
        column = feature_indexes[term]
        scores[term] += float(matrix.getrow(row_index).toarray()[0][column])

    ranked = [term for term, _score in sorted(scores.items(), key=lambda item: (-item[1], item[0]))]
    return ranked[:5], ranked


def _cluster_label(representative_terms: list[str]) -> str:
    if not representative_terms:
        return "Unlabelled cluster"
    if len(representative_terms) == 1:
        return representative_terms[0]
    return " / ".join(representative_terms[:2])[:80]
