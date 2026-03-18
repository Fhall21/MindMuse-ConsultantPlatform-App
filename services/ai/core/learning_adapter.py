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

from models.schemas import LearningSignal

MAX_SIGNALS = 20


def build_personalization_prompt(signals: list[LearningSignal]) -> str:
    """Convert learning signals into a prompt section for theme extraction.

    Args:
        signals: User-scoped learning signals, ideally ordered most-recent-first
                 by the caller. Each has label, decision_type, rationale, weight.

    Returns:
        A string to append to the system prompt. Empty string if no signals.
    """
    if not signals:
        return ""

    # Select top signals by weight (descending), preserving order stability
    # for equal weights (which preserves caller's recency ordering).
    selected = sorted(signals, key=lambda s: s.weight, reverse=True)[:MAX_SIGNALS]

    preferred: list[str] = []
    avoided: list[str] = []
    user_created: list[str] = []

    for sig in selected:
        if sig.decision_type == "user_added":
            user_created.append(sig.label)
        elif sig.decision_type == "accepted":
            preferred.append(sig.label)
        elif sig.decision_type == "rejected":
            reason = f" (reason: {sig.rationale})" if sig.rationale else ""
            avoided.append(f"{sig.label}{reason}")

    sections: list[str] = []

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

    if not sections:
        return ""

    header = (
        "\n\n--- User preference context ---\n"
        "The following reflects this specific consultant's past theme decisions. "
        "Use it as soft guidance — not rigid rules. The transcript content "
        "always takes priority over historical preferences.\n\n"
    )

    return header + "\n\n".join(sections)
