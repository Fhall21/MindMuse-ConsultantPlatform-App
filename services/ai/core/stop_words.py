from __future__ import annotations

from dataclasses import replace

from core.extraction import Term, get_nlp

DOMAIN_ALLOWLIST = {
    "ptsd",
    "fmla",
    "rto",
    "return to work",
    "workplace injury",
    "psychosocial risk",
    "res ipsa loquitur",
    "in camera",
    "ex parte",
    "reasonable adjustment",
    "functional capacity",
    "trauma response",
}

_EXTRA_STOP_WORDS = {
    "okay",
    "yeah",
    "right",
    "thing",
    "things",
    "stuff",
    "actually",
    "basically",
    "literally",
    "really",
    "kind",
    "kinda",
    "sort",
    "sorta",
    "uh",
    "um",
    "hmm",
    "mm",
    "hello",
    "thanks",
    "thank",
    "please",
    "session",
    "consultation",
    "today",
    "tomorrow",
    "yesterday",
    "week",
    "month",
    "year",
    "meeting",
    "discussion",
    "point",
    "bit",
    "part",
    "kind of",
    "sort of",
}


# en_core_web_* stop words plus additional fillers exceed 500 terms in practice.
_cached_stop_words: set[str] | None = None


def get_base_stop_words() -> set[str]:
    global _cached_stop_words
    if _cached_stop_words is None:
        _cached_stop_words = {
            word.lower() for word in get_nlp().Defaults.stop_words
        }.union(_EXTRA_STOP_WORDS)
    return _cached_stop_words


def filter_terms(
    terms: list[Term],
    document_frequency_ratio: dict[str, float] | None = None,
    frequency_threshold: float = 0.9,
) -> list[Term]:
    cleaned: list[Term] = []
    seen: set[str] = set()

    for term in terms:
        key = term.term.strip().lower()
        if not key:
            continue

        if key in seen:
            continue

        if key not in DOMAIN_ALLOWLIST and _is_stop_word(key):
            continue

        if key not in DOMAIN_ALLOWLIST and document_frequency_ratio:
            if document_frequency_ratio.get(key, 0.0) >= frequency_threshold:
                continue

        seen.add(key)
        cleaned.append(replace(term, term=key))

    return cleaned


def _is_stop_word(term: str) -> bool:
    base_stop_words = get_base_stop_words()
    if term in base_stop_words:
        return True
    parts = term.split()
    if len(parts) == 1:
        return False
    return all(part in base_stop_words for part in parts)
