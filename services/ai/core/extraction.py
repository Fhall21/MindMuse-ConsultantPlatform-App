from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import asdict, dataclass, field
from typing import Any, Protocol

import spacy
from spacy.language import Language

from core.config import settings
from core.openai_client import get_client

logger = logging.getLogger(__name__)

_NEGATION_WORDS = {
    "no",
    "not",
    "never",
    "without",
    "denies",
    "denied",
    "lack",
    "lacks",
    "lacking",
}

_nlp_instance: Language | None = None


class LangExtractAdapter(Protocol):
    def extract_terms(self, transcript: str, timeout_seconds: float) -> list[dict[str, Any]]:
        ...


@dataclass(frozen=True)
class TermOffset:
    start: int
    end: int
    consultation_id: int | None = None
    round_number: int | None = None


@dataclass
class Term:
    term: str
    original: str
    offsets: list[TermOffset]
    confidence: float = 0.5
    extraction_source: str = "langextract"
    pos_tags: list[str] = field(default_factory=list)
    negation_context: bool = False


@dataclass
class ExtractionMetadata:
    extraction_method: str
    fallback_used: bool
    reduced_recall: bool
    confidence: float
    duration_ms: int
    errors: list[str] = field(default_factory=list)


@dataclass
class ExtractionResult:
    terms: list[Term]
    metadata: ExtractionMetadata

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class OpenAILangExtractAdapter:
    """Structured extraction prompt that emulates langextract behavior."""

    def extract_terms(self, transcript: str, timeout_seconds: float) -> list[dict[str, Any]]:
        client = get_client()
        completion = client.chat.completions.create(
            model=settings.openai_model,
            temperature=0,
            timeout=timeout_seconds,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Extract clinically or legally meaningful terms and short phrases from the transcript. "
                        "Return strict JSON with key 'terms' where each item has keys: "
                        "term (string), confidence (0-1 float), phrase (boolean)."
                    ),
                },
                {
                    "role": "user",
                    "content": transcript,
                },
            ],
        )
        content = completion.choices[0].message.content or "{}"
        parsed = json.loads(content)
        terms = parsed.get("terms")
        if not isinstance(terms, list):
            return []

        normalized: list[dict[str, Any]] = []
        for item in terms:
            if not isinstance(item, dict):
                continue
            term = str(item.get("term", "")).strip()
            if not term:
                continue
            confidence = item.get("confidence", 0.6)
            try:
                confidence_value = float(confidence)
            except (TypeError, ValueError):
                confidence_value = 0.6
            normalized.append(
                {
                    "term": term,
                    "confidence": max(0.0, min(1.0, confidence_value)),
                    "source": "langextract",
                }
            )
        return normalized


def get_nlp() -> Language:
    global _nlp_instance
    if _nlp_instance is not None:
        return _nlp_instance

    try:
        _nlp_instance = spacy.load("en_core_web_md")
    except OSError:
        # Keep pipeline deterministic even if the medium model is unavailable.
        try:
            _nlp_instance = spacy.load("en_core_web_sm")
        except OSError:
            _nlp_instance = spacy.blank("en")
    return _nlp_instance


def extract_terms_with_offsets(
    transcript: str,
    consultation_id: int | None = None,
    round_number: int | None = None,
    timeout_seconds: float = 15.0,
    adapter: LangExtractAdapter | None = None,
) -> ExtractionResult:
    started = time.perf_counter()
    errors: list[str] = []

    if not transcript.strip():
        duration = int((time.perf_counter() - started) * 1000)
        return ExtractionResult(
            terms=[],
            metadata=ExtractionMetadata(
                extraction_method="none",
                fallback_used=False,
                reduced_recall=False,
                confidence=0.0,
                duration_ms=duration,
                errors=[],
            ),
        )

    fallback_used = False
    extraction_method = "langextract+spacy_offsets"

    langextract_adapter = adapter or OpenAILangExtractAdapter()
    raw_terms: list[dict[str, Any]] = []
    try:
        raw_terms = langextract_adapter.extract_terms(transcript, timeout_seconds)
    except Exception as exc:  # noqa: BLE001
        fallback_used = True
        extraction_method = "spacy_fallback"
        errors.append(f"langextract_unavailable:{exc.__class__.__name__}")
        logger.warning("Langextract path failed, using spaCy fallback", extra={"error": str(exc)})
        raw_terms = _spacy_fallback_terms(transcript)

    if not raw_terms:
        fallback_used = True
        extraction_method = "spacy_fallback"
        raw_terms = _spacy_fallback_terms(transcript)

    terms = _map_terms_to_offsets(
        transcript=transcript,
        candidates=raw_terms,
        consultation_id=consultation_id,
        round_number=round_number,
    )

    duration = int((time.perf_counter() - started) * 1000)
    confidence = round(sum(term.confidence for term in terms) / max(len(terms), 1), 4)
    metadata = ExtractionMetadata(
        extraction_method=extraction_method,
        fallback_used=fallback_used,
        reduced_recall=fallback_used,
        confidence=confidence,
        duration_ms=duration,
        errors=errors,
    )
    return ExtractionResult(terms=terms, metadata=metadata)


def _spacy_fallback_terms(transcript: str) -> list[dict[str, Any]]:
    doc = get_nlp()(transcript)
    candidates: dict[str, float] = {}

    for ent in doc.ents:
        cleaned = ent.text.strip()
        if len(cleaned) < 2:
            continue
        candidates[cleaned] = max(candidates.get(cleaned, 0.0), 0.75)

    try:
        noun_chunks = list(doc.noun_chunks)
    except Exception:  # noqa: BLE001
        noun_chunks = []

    for chunk in noun_chunks:
        cleaned = chunk.text.strip()
        if len(cleaned) < 3:
            continue
        candidates[cleaned] = max(candidates.get(cleaned, 0.0), 0.65)

    for token in doc:
        if token.is_stop or token.is_punct or token.is_space:
            continue
        if token.pos_ in {"NOUN", "PROPN", "ADJ"} and len(token.text) >= 4:
            candidates[token.text] = max(candidates.get(token.text, 0.0), 0.55)

    return [
        {"term": term, "confidence": confidence, "source": "spacy"}
        for term, confidence in candidates.items()
    ]


def _map_terms_to_offsets(
    transcript: str,
    candidates: list[dict[str, Any]],
    consultation_id: int | None,
    round_number: int | None,
) -> list[Term]:
    nlp = get_nlp()
    doc = nlp(transcript)
    extracted: list[Term] = []
    seen: set[str] = set()

    for candidate in candidates:
        raw_term = str(candidate.get("term", "")).strip()
        if not raw_term:
            continue
        normalized_key = raw_term.casefold()
        if normalized_key in seen:
            continue

        offsets = _find_offsets(transcript, raw_term)
        if not offsets:
            continue

        pos_tags = _collect_pos_tags(doc, offsets)
        negation_context = _has_negation_context(doc, offsets)
        confidence = float(candidate.get("confidence", 0.6))
        source = str(candidate.get("source", "langextract"))

        seen.add(normalized_key)
        extracted.append(
            Term(
                term=raw_term,
                original=raw_term,
                offsets=[
                    TermOffset(
                        start=start,
                        end=end,
                        consultation_id=consultation_id,
                        round_number=round_number,
                    )
                    for start, end in offsets
                ],
                confidence=max(0.0, min(1.0, confidence)),
                extraction_source=source,
                pos_tags=pos_tags,
                negation_context=negation_context,
            )
        )

    return extracted


def _find_offsets(transcript: str, term: str) -> list[tuple[int, int]]:
    escaped = re.escape(term)
    pattern = re.compile(rf"(?<!\w){escaped}(?!\w)", flags=re.IGNORECASE)
    return [(match.start(), match.end()) for match in pattern.finditer(transcript)]


def _collect_pos_tags(doc: Any, offsets: list[tuple[int, int]]) -> list[str]:
    tags: set[str] = set()
    for start, end in offsets:
        for token in doc:
            if token.idx >= end:
                break
            if token.idx + len(token.text) <= start:
                continue
            tags.add(token.pos_)
    return sorted(tags)


def _has_negation_context(doc: Any, offsets: list[tuple[int, int]]) -> bool:
    for start, _ in offsets:
        nearby_tokens = [
            token
            for token in doc
            if token.idx < start and token.idx + len(token.text) > max(start - 24, 0)
        ]
        if any(token.text.lower() in _NEGATION_WORDS for token in nearby_tokens):
            return True
    return False
