"""Prompt personalization from user-scoped theme learning signals.

This module converts a user's theme decision history (accept/reject/user-added)
into a compact prompt section that steers the LLM toward themes the user finds
meaningful and away from themes they've consistently rejected.

Design constraints:
- Prompt growth is bounded: max 20 signals are included, selected by weight
  then recency (list order, since the caller sorts by recency).
- The output is a plain-text paragraph, not structured data — the LLM should
  treat it as soft guidance, not hard constraints.
- Empty signals produce an empty string (no-op).
- No cross-user leakage: signals are scoped by the caller before reaching here.

Weighting logic:
- user_added (weight ~1.5–2.0): strongest positive signal. These are themes the
  user explicitly created, meaning the AI missed them. The prompt tells the LLM
  to look for similar themes.
- accepted (weight ~1.0): moderate positive. The AI suggested it and the user
  confirmed — reinforces that this type of theme is valuable.
- rejected (weight ~1.0): negative signal. The prompt tells the LLM to avoid
  similar themes unless the transcript clearly warrants them, and includes the
  user's rationale so the LLM understands *why* (e.g., "too vague", "not
  substantive", "administrative, not psychosocial").

Edge cases:
- Conflicting signals (same label accepted and rejected): both are included;
  the LLM sees the contradiction and can weigh the more recent signal.
- Very short transcript + many signals: the LLM may still return few themes.
  This is correct — signals guide, they don't force output.
- Sparse data (1-2 signals): the prompt section is small and low-impact,
  which is the right behavior for a new user.
"""

from __future__ import annotations

from models.schemas import AIInsightLearning, LearningSignal, UserPreferences

MAX_SIGNALS = 20
MAX_LEARNINGS = 6


def build_personalization_prompt(
    signals: list[LearningSignal],
    preferences: UserPreferences | None = None,
    learnings: list[AIInsightLearning] | None = None,
) -> str:
    """Convert learning signals into a prompt section for theme extraction.

    Args:
        signals: User-scoped learning signals, ideally ordered most-recent-first
                 by the caller. Each has label, decision_type, rationale, weight.
        preferences: Optional saved AI preferences such as focus areas,
                 consultation types, and excluded topics.
        learnings: Optional persisted higher-order patterns extracted from
               historical decisions.

    Returns:
        A string to append to the system prompt. Empty string if no signal or
        preference context is available.
    """
    sections: list[str] = []

    if signals:
        # Select top signals by weight (descending), preserving order stability
        # for equal weights (which preserves caller's recency ordering).
        selected = sorted(signals, key=lambda s: s.weight, reverse=True)[:MAX_SIGNALS]

        preferred: list[str] = []
        avoided: list[str] = []
        user_created: list[str] = []

        for sig in selected:
            if sig.decision_type == "user_added":
                user_created.append(sig.label)
            elif sig.decision_type == "accept":
                preferred.append(sig.label)
            elif sig.decision_type == "reject":
                reason = f" (reason: {sig.rationale})" if sig.rationale else ""
                avoided.append(f"{sig.label}{reason}")

        if user_created:
            labels = ", ".join(f'"{t}"' for t in user_created)
            sections.append(
                f"This consultant has previously identified themes like {labels} "
                f"that were not suggested by the system. These represent high-value "
                f"theme types — look for similar themes in this transcript."
            )

        if preferred:
            labels = ", ".join(f'"{t}"' for t in preferred)
            sections.append(
                f"This consultant has confirmed themes like {labels} as substantive "
                f"in past consultations. Similar themes are likely valuable if "
                f"supported by the transcript."
            )

        if avoided:
            items = "; ".join(avoided)
            sections.append(
                f"This consultant has previously rejected these themes: {items}. "
                f"Avoid suggesting similar themes unless the transcript clearly "
                f"warrants them with substantive discussion."
            )

    if learnings:
        learning_lines = [_format_learning_line(learning) for learning in learnings[:MAX_LEARNINGS]]
        learning_lines = [line for line in learning_lines if line]

        if learning_lines:
            sections.append(
                "Persisted AI learnings from prior review history: "
                + " ".join(learning_lines)
            )

    if preferences:
        preference_lines: list[str] = []
        if preferences.focus_areas:
            focus_areas = ", ".join(f'"{item}"' for item in preferences.focus_areas)
            preference_lines.append(f"Prioritise themes related to focus areas: {focus_areas}.")
        if preferences.consultation_types:
            consultation_types = ", ".join(f'"{item}"' for item in preferences.consultation_types)
            preference_lines.append(
                f"Consider the consultant's common consultation contexts: {consultation_types}."
            )
        if preferences.excluded_topics:
            excluded_topics = ", ".join(f'"{item}"' for item in preferences.excluded_topics)
            preference_lines.append(
                f"Avoid centring themes on excluded topics unless the transcript makes them clearly substantive: {excluded_topics}."
            )
        if preference_lines:
            sections.append("Saved user preferences: " + " ".join(preference_lines))

    if not sections:
        return ""

    header = (
        "\n\n--- User preference context ---\n"
        "The following reflects this specific consultant's past theme decisions. "
        "Use it as soft guidance — not rigid rules. The transcript content "
        "always takes priority over historical preferences.\n\n"
    )

    return header + "\n\n".join(sections)


def _format_learning_line(learning: AIInsightLearning) -> str:
    metrics = learning.supporting_metrics or {}

    if learning.learning_type == "process_pattern":
        confidence = _format_percentage(metrics.get("confidence_score"))
        suffix = f" Confidence {confidence}." if confidence else ""
        return f"Process pattern '{learning.label}': {learning.description}{suffix}"

    if learning.learning_type == "trend":
        accepted_count = metrics.get("accepted_count")
        percentage = _format_percentage(metrics.get("percentage"))
        details: list[str] = []
        if isinstance(accepted_count, (int, float)):
            details.append(f"{int(accepted_count)} accepted")
        if percentage:
            details.append(f"{percentage} share")
        suffix = f" ({', '.join(details)})" if details else ""
        return f"Accepted trend '{learning.label}': {learning.description}{suffix}."

    if learning.learning_type == "rejection_signal":
        reasons = metrics.get("rejection_reasons")
        formatted_reasons = _format_rejection_reasons(reasons)
        suffix = f" Common rejection reasons: {formatted_reasons}." if formatted_reasons else ""
        return f"Rejection signal '{learning.label}': {learning.description}{suffix}"

    if learning.learning_type == "preference_alignment":
        alignment_count = metrics.get("alignment_count")
        preference_labels = metrics.get("preference_labels")
        details: list[str] = []
        if isinstance(alignment_count, (int, float)):
            details.append(f"{int(alignment_count)} matches")
        if isinstance(preference_labels, list) and preference_labels:
            quoted = ", ".join(f'"{label}"' for label in preference_labels[:3])
            details.append(f"aligned with {quoted}")
        suffix = f" ({'; '.join(details)})" if details else ""
        return f"Preference alignment '{learning.label}': {learning.description}{suffix}."

    return f"Learned pattern '{learning.label}': {learning.description}"


def _format_percentage(value: object) -> str:
    if not isinstance(value, (int, float)):
        return ""

    return f"{round(float(value) * 100)}%"


def _format_rejection_reasons(value: object) -> str:
    if not isinstance(value, dict):
        return ""

    sorted_reasons = sorted(
        value.items(), key=lambda item: int(item[1]) if isinstance(item[1], (int, float)) else 0, reverse=True
    )
    labels = [str(reason) for reason, _count in sorted_reasons[:2]]
    return " and ".join(labels)
