"""Extract stable AI learnings from a consultant's recent insight decisions.

Stage 9 keeps this analyzer intentionally lightweight:
- reads only the user's most recent decision history
- emits a small, bounded set of learnings for prompt personalization
- relies on explicit heuristics, not a second LLM pass
"""

from __future__ import annotations

import logging
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

MIN_SIGNALS = 5
DEFAULT_TOPIC_TYPE = "theme_generation"
DEFAULT_SIGNAL_LIMIT = 50
POSITIVE_DECISION_TYPES = {"accept", "user_added"}
TOKEN_STOPWORDS = {
    "a",
    "an",
    "and",
    "around",
    "assessment",
    "case",
    "consultation",
    "consultant",
    "for",
    "from",
    "in",
    "into",
    "of",
    "on",
    "or",
    "the",
    "theme",
    "themes",
    "their",
    "this",
    "to",
    "with",
    "workplace",
}
REJECTION_REASON_PATTERNS: dict[str, tuple[str, ...]] = {
    "too_vague": ("vague", "generic", "broad", "high level", "too high level"),
    "not_psychosocial": ("not psychosocial", "administrative", "operational", "compliance"),
    "needs_specificity": ("specific", "concrete", "evidence", "detail", "example"),
    "duplicate": ("duplicate", "already covered", "repeated", "same as"),
}
FETCH_RECENT_SIGNALS_QUERY = """
SELECT insight_label, decision_type, rationale, created_at
FROM insight_decision_logs
WHERE user_id = :user_id
ORDER BY created_at DESC
LIMIT :limit
"""
FETCH_USER_PREFERENCES_QUERY = """
SELECT consultation_types, focus_areas, excluded_topics
FROM user_ai_preferences
WHERE user_id = :user_id
LIMIT 1
"""


@dataclass(frozen=True)
class AIInsightLearning:
    user_id: str
    topic_type: str
    learning_type: str
    label: str
    description: str
    supporting_metrics: dict[str, Any]
    created_at: datetime
    expires_at: datetime | None = None
    version: int = 1


def analyze_user_signals(
    user_id: str,
    topic_type: str = DEFAULT_TOPIC_TYPE,
    limit: int = DEFAULT_SIGNAL_LIMIT,
    engine: Any | None = None,
) -> list[AIInsightLearning]:
    """Build bounded learnings from recent user decisions.

    Returns an empty list when there is not enough signal history to avoid
    fabricating personalization from sparse data.
    """
    if limit <= 0:
        return []

    db_engine = engine or _create_db_engine()
    signals = _fetch_recent_signals(db_engine, user_id, limit)
    if len(signals) < MIN_SIGNALS:
        return []

    preferences = _fetch_user_preferences(db_engine, user_id)
    created_at = datetime.now(timezone.utc)
    learnings: list[AIInsightLearning] = []

    for builder in (
        _build_process_pattern_learning,
        _build_trend_learning,
        _build_rejection_signal_learning,
        _build_preference_alignment_learning,
    ):
        learning = builder(user_id, topic_type, created_at, signals, preferences)
        if learning is not None:
            learnings.append(learning)

    return learnings


def _build_process_pattern_learning(
    user_id: str,
    topic_type: str,
    created_at: datetime,
    signals: list[dict[str, Any]],
    _preferences: dict[str, list[str]],
) -> AIInsightLearning | None:
    positive_signals = [signal for signal in signals if signal["decision_type"] in POSITIVE_DECISION_TYPES]
    if len(positive_signals) < 2:
        return None

    token_counts: Counter[str] = Counter()
    examples: defaultdict[str, list[str]] = defaultdict(list)
    for signal in positive_signals:
        label = str(signal["insight_label"])
        for token in set(_keyword_tokens(label)):
            token_counts[token] += 1
            if label not in examples[token] and len(examples[token]) < 3:
                examples[token].append(label)

    if token_counts:
        token, matched_count = token_counts.most_common(1)[0]
        if matched_count >= 2:
            topic_label = token.replace("_", " ")
            confidence = _confidence_score(matched_count, len(positive_signals))
            example_labels = examples[token]
            return AIInsightLearning(
                user_id=user_id,
                topic_type=topic_type,
                learning_type="process_pattern",
                label=f"Prefers {topic_label}-focused insights",
                description=(
                    f"Recent accepted or added insights repeatedly focus on {topic_label}. "
                    f"Examples include {_format_examples(example_labels)}."
                ),
                supporting_metrics={
                    "accepted_count": matched_count,
                    "example_labels": example_labels,
                    "confidence_score": confidence,
                },
                created_at=created_at,
            )

    label_counts = Counter(_normalize_phrase(str(signal["insight_label"])) for signal in positive_signals)
    top_label, count = label_counts.most_common(1)[0]
    if not top_label:
        return None
    example_labels = [
        str(signal["insight_label"])
        for signal in positive_signals
        if _normalize_phrase(str(signal["insight_label"])) == top_label
    ][:3]
    confidence = _confidence_score(count, len(positive_signals))
    label_text = _title_case_phrase(top_label)
    return AIInsightLearning(
        user_id=user_id,
        topic_type=topic_type,
        learning_type="process_pattern",
        label=f"Frequently reinforces {label_text}",
        description=(
            f"The consultant keeps accepting closely related insights in {label_text}. "
            f"Examples include {_format_examples(example_labels)}."
        ),
        supporting_metrics={
            "accepted_count": count,
            "example_labels": example_labels,
            "confidence_score": confidence,
        },
        created_at=created_at,
    )


def _build_trend_learning(
    user_id: str,
    topic_type: str,
    created_at: datetime,
    signals: list[dict[str, Any]],
    _preferences: dict[str, list[str]],
) -> AIInsightLearning | None:
    positive_signals = [signal for signal in signals if signal["decision_type"] in POSITIVE_DECISION_TYPES]
    if not positive_signals:
        return None

    label_counts = Counter(_normalize_phrase(str(signal["insight_label"])) for signal in positive_signals)
    top_label, count = label_counts.most_common(1)[0]
    if not top_label:
        return None

    matching_labels = [
        str(signal["insight_label"])
        for signal in positive_signals
        if _normalize_phrase(str(signal["insight_label"])) == top_label
    ]
    percentage = round((count / len(positive_signals)) * 100, 1)
    confidence = _confidence_score(count, len(positive_signals))
    label_text = _title_case_phrase(top_label)
    return AIInsightLearning(
        user_id=user_id,
        topic_type=topic_type,
        learning_type="trend",
        label=f"Strong interest in {label_text}",
        description=(
            f"{count} of the last {len(positive_signals)} accepted or user-added insights focused on "
            f"{label_text} ({percentage}%)."
        ),
        supporting_metrics={
            "accepted_count": count,
            "percentage": percentage,
            "example_labels": matching_labels[:3],
            "confidence_score": confidence,
        },
        created_at=created_at,
    )


def _build_rejection_signal_learning(
    user_id: str,
    topic_type: str,
    created_at: datetime,
    signals: list[dict[str, Any]],
    _preferences: dict[str, list[str]],
) -> AIInsightLearning | None:
    rejected_signals = [signal for signal in signals if signal["decision_type"] == "reject"]
    if not rejected_signals:
        return None

    grouped_reasons: Counter[str] = Counter()
    raw_reasons: Counter[str] = Counter()
    example_labels: list[str] = []
    for signal in rejected_signals:
        rationale = str(signal.get("rationale") or "").strip()
        reason_key = _classify_rejection_reason(rationale, str(signal["insight_label"]))
        grouped_reasons[reason_key] += 1
        raw_reasons[rationale.lower() or reason_key] += 1
        label = str(signal["insight_label"])
        if label not in example_labels and len(example_labels) < 3:
            example_labels.append(label)

    reason_key, count = grouped_reasons.most_common(1)[0]
    reason_label = _rejection_reason_label(reason_key)
    confidence = _confidence_score(count, len(rejected_signals))
    return AIInsightLearning(
        user_id=user_id,
        topic_type=topic_type,
        learning_type="rejection_signal",
        label=f"Often rejects {reason_label}",
        description=(
            f"Rejected insights most often cluster around {reason_label}. "
            f"Recent examples include {_format_examples(example_labels)}."
        ),
        supporting_metrics={
            "rejection_count": count,
            "rejection_reasons": dict(raw_reasons),
            "example_labels": example_labels,
            "confidence_score": confidence,
        },
        created_at=created_at,
    )


def _build_preference_alignment_learning(
    user_id: str,
    topic_type: str,
    created_at: datetime,
    signals: list[dict[str, Any]],
    preferences: dict[str, list[str]],
) -> AIInsightLearning | None:
    preference_labels = [
        label
        for label in [*preferences["focus_areas"], *preferences["consultation_types"]]
        if label
    ]
    if not preference_labels:
        return None

    positive_signals = [signal for signal in signals if signal["decision_type"] in POSITIVE_DECISION_TYPES]
    if not positive_signals:
        return None

    matches: defaultdict[str, list[str]] = defaultdict(list)
    for preference in preference_labels:
        for signal in positive_signals:
            label = str(signal["insight_label"])
            if _phrase_matches(preference, label) and label not in matches[preference]:
                matches[preference].append(label)

    if not matches:
        return None

    best_preference, example_labels = max(matches.items(), key=lambda item: len(item[1]))
    match_count = len(example_labels)
    confidence = _confidence_score(match_count, len(positive_signals))
    return AIInsightLearning(
        user_id=user_id,
        topic_type=topic_type,
        learning_type="preference_alignment",
        label=f"Preferences align with {best_preference}",
        description=(
            f"Saved preferences and accepted insights line up around {best_preference}. "
            f"Matched examples include {_format_examples(example_labels[:3])}."
        ),
        supporting_metrics={
            "alignment_count": match_count,
            "preference_labels": [best_preference],
            "example_labels": example_labels[:3],
            "confidence_score": confidence,
        },
        created_at=created_at,
    )


def _fetch_recent_signals(engine: Any, user_id: str, limit: int) -> list[dict[str, Any]]:
    with engine.begin() as conn:
        result = conn.execute(_sql(FETCH_RECENT_SIGNALS_QUERY), {"user_id": user_id, "limit": limit})
        return [dict(row) for row in result.mappings()]


def _fetch_user_preferences(engine: Any, user_id: str) -> dict[str, list[str]]:
    empty_preferences = {
        "consultation_types": [],
        "focus_areas": [],
        "excluded_topics": [],
    }
    with engine.begin() as conn:
        result = conn.execute(_sql(FETCH_USER_PREFERENCES_QUERY), {"user_id": user_id})
        rows = [dict(row) for row in result.mappings()]

    if not rows:
        return empty_preferences

    row = rows[0]
    return {
        "consultation_types": list(row.get("consultation_types") or []),
        "focus_areas": list(row.get("focus_areas") or []),
        "excluded_topics": list(row.get("excluded_topics") or []),
    }


def _create_db_engine() -> Any:
    from core.config import settings
    from sqlalchemy import create_engine

    database_url = settings.build_database_url()
    if not database_url:
        raise ValueError(
            "Learning analyzer requires DATABASE_URL or DATABASE_HOST/PORT/NAME/USER/PASSWORD env vars."
        )
    return create_engine(database_url, future=True, pool_pre_ping=True)


def _sql(query: str) -> Any:
    try:
        from sqlalchemy import text
    except ModuleNotFoundError:
        return query
    return text(query)


def _classify_rejection_reason(rationale: str, insight_label: str) -> str:
    rationale_lower = rationale.lower()
    for reason, patterns in REJECTION_REASON_PATTERNS.items():
        if any(pattern in rationale_lower for pattern in patterns):
            return reason

    label_tokens = _keyword_tokens(insight_label)
    if label_tokens:
        return f"label:{label_tokens[0]}"
    return "other"


def _rejection_reason_label(reason_key: str) -> str:
    if reason_key == "too_vague":
        return "overly vague insights"
    if reason_key == "not_psychosocial":
        return "non-psychosocial or administrative insights"
    if reason_key == "needs_specificity":
        return "insights lacking concrete detail"
    if reason_key == "duplicate":
        return "duplicate insights"
    if reason_key.startswith("label:"):
        return f"{reason_key.split(':', 1)[1]}-focused insights"
    return "a recurring pattern"


def _keyword_tokens(value: str) -> list[str]:
    normalized = _normalize_phrase(value)
    return [token for token in normalized.split() if token and token not in TOKEN_STOPWORDS]


def _normalize_phrase(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()
    return re.sub(r"\s+", " ", cleaned)


def _title_case_phrase(value: str) -> str:
    return " ".join(part.capitalize() for part in value.split())


def _phrase_matches(preference: str, insight_label: str) -> bool:
    preference_tokens = set(_keyword_tokens(preference))
    insight_tokens = set(_keyword_tokens(insight_label))
    if preference_tokens and insight_tokens and preference_tokens.intersection(insight_tokens):
        return True

    normalized_preference = _normalize_phrase(preference)
    normalized_label = _normalize_phrase(insight_label)
    return bool(normalized_preference and normalized_preference in normalized_label)


def _confidence_score(match_count: int, population: int) -> float:
    if population <= 0:
        return 0.0
    score = 0.35 + (match_count / population) * 0.55
    return round(min(score, 0.95), 2)


def _format_examples(labels: list[str]) -> str:
    if not labels:
        return "similar recent themes"
    if len(labels) == 1:
        return f'"{labels[0]}"'
    return ", ".join(f'"{label}"' for label in labels)