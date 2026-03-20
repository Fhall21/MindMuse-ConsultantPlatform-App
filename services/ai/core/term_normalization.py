from __future__ import annotations

import unicodedata
from collections import defaultdict

from core.extraction import Term, get_nlp


def normalize_terms(terms: list[Term]) -> list[Term]:
    grouped: dict[str, list[Term]] = defaultdict(list)
    for term in terms:
        canonical = _canonical_form(term.term)
        if not canonical:
            continue
        grouped[canonical].append(term)

    normalized: list[Term] = []
    for canonical, variants in grouped.items():
        first = variants[0]
        merged_offsets = []
        pos_tags: set[str] = set()
        confidence = 0.0
        negation_context = False

        for variant in variants:
            merged_offsets.extend(variant.offsets)
            pos_tags.update(variant.pos_tags)
            confidence = max(confidence, variant.confidence)
            negation_context = negation_context or variant.negation_context

        normalized.append(
            Term(
                term=canonical,
                original=first.original,
                offsets=merged_offsets,
                confidence=confidence,
                extraction_source=first.extraction_source,
                pos_tags=sorted(pos_tags),
                negation_context=negation_context,
            )
        )

    return normalized


def _canonical_form(text: str) -> str:
    lowered = text.strip().lower()
    if not lowered:
        return ""

    ascii_text = _strip_accents(lowered)
    doc = get_nlp()(ascii_text)

    lemmatized_parts: list[str] = []
    for token in doc:
        if token.is_space or token.is_punct:
            continue
        lemma = token.lemma_.strip().lower()
        if not lemma or lemma == "-pron-":
            lemma = token.text.lower()
        lemma = _fallback_stem(lemma)
        lemmatized_parts.append(lemma)

    return " ".join(lemmatized_parts).strip()


def _strip_accents(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def _fallback_stem(token: str) -> str:
    if len(token) > 5 and token.endswith("ment"):
        return token[:-4]
    if len(token) > 6 and token.endswith("ing"):
        return token[:-3]
    if len(token) > 5 and token.endswith("ed"):
        return token[:-2]
    return token
