import os
import sys

import spacy

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.extraction import (  # noqa: E402
    ExtractionResult,
    Term,
    TermOffset,
    extract_terms_with_offsets,
)
from core.stop_words import DOMAIN_ALLOWLIST, filter_terms, get_base_stop_words  # noqa: E402
from core.term_normalization import normalize_terms  # noqa: E402
from workers.extraction_task import run_extraction  # noqa: E402


class FakeAdapter:
    def __init__(self, terms):
        self.terms = terms

    def extract_terms(self, transcript: str, timeout_seconds: float):  # noqa: ARG002
        return self.terms


class FailingAdapter:
    def extract_terms(self, transcript: str, timeout_seconds: float):  # noqa: ARG002
        raise TimeoutError("simulated timeout")


def _patch_nlp(monkeypatch):
    nlp = spacy.blank("en")
    monkeypatch.setattr("core.extraction._nlp_instance", nlp)


def test_empty_transcript_returns_empty(monkeypatch):
    _patch_nlp(monkeypatch)
    result = extract_terms_with_offsets("   ")
    assert isinstance(result, ExtractionResult)
    assert result.terms == []
    assert result.metadata.extraction_method == "none"


def test_langextract_primary_with_offsets(monkeypatch):
    _patch_nlp(monkeypatch)
    transcript = "PTSD symptoms are severe. Workplace injury concerns are ongoing."
    adapter = FakeAdapter([
        {"term": "PTSD", "confidence": 0.9, "source": "langextract"},
        {"term": "workplace injury", "confidence": 0.88, "source": "langextract"},
    ])

    result = extract_terms_with_offsets(transcript, consultation_id=42, round_number=2, adapter=adapter)

    assert len(result.terms) == 2
    assert result.metadata.fallback_used is False
    assert all(term.offsets for term in result.terms)
    assert result.terms[0].offsets[0].consultation_id == 42
    assert result.terms[0].offsets[0].round_number == 2


def test_fallback_when_langextract_fails(monkeypatch):
    _patch_nlp(monkeypatch)
    transcript = "The claimant reported chronic anxiety and workplace pressure."
    result = extract_terms_with_offsets(transcript, adapter=FailingAdapter())

    assert result.metadata.fallback_used is True
    assert result.metadata.reduced_recall is True
    assert result.metadata.extraction_method == "spacy_fallback"


def test_terms_without_match_are_dropped(monkeypatch):
    _patch_nlp(monkeypatch)
    transcript = "Simple transcript text."
    adapter = FakeAdapter([{"term": "missing phrase", "confidence": 0.7}])
    result = extract_terms_with_offsets(transcript, adapter=adapter)

    assert result.terms == []


def test_negation_context_detected(monkeypatch):
    _patch_nlp(monkeypatch)
    transcript = "She denied employment history but discussed family support."
    adapter = FakeAdapter([{"term": "employment history", "confidence": 0.8}])

    result = extract_terms_with_offsets(transcript, adapter=adapter)

    assert len(result.terms) == 1
    assert result.terms[0].negation_context is True


def test_normalization_groups_variants(monkeypatch):
    _patch_nlp(monkeypatch)
    terms = [
        Term("employment", "employment", [TermOffset(0, 10)], confidence=0.7),
        Term("employing", "employing", [TermOffset(15, 24)], confidence=0.8),
    ]

    normalized = normalize_terms(terms)

    assert len(normalized) == 1
    assert normalized[0].confidence == 0.8
    assert len(normalized[0].offsets) == 2


def test_normalization_strips_accents(monkeypatch):
    _patch_nlp(monkeypatch)
    terms = [Term("naïve coping", "naïve coping", [TermOffset(0, 11)], confidence=0.7)]

    normalized = normalize_terms(terms)

    assert normalized[0].term == "naive coping"


def test_stop_word_filter_keeps_domain_allowlist(monkeypatch):
    _patch_nlp(monkeypatch)
    assert "ptsd" in DOMAIN_ALLOWLIST
    terms = [
        Term("PTSD", "PTSD", [TermOffset(0, 4)], confidence=0.8),
        Term("the", "the", [TermOffset(5, 8)], confidence=0.4),
    ]

    filtered = filter_terms(terms)

    assert len(filtered) == 1
    assert filtered[0].term == "ptsd"


def test_frequency_ratio_filtering(monkeypatch):
    _patch_nlp(monkeypatch)
    terms = [
        Term("case management", "case management", [TermOffset(0, 15)], confidence=0.6),
        Term("workplace injury", "workplace injury", [TermOffset(16, 32)], confidence=0.8),
    ]

    filtered = filter_terms(
        terms,
        document_frequency_ratio={"case management": 0.95, "workplace injury": 0.2},
        frequency_threshold=0.9,
    )

    assert len(filtered) == 1
    assert filtered[0].term == "workplace injury"


def test_base_stop_words_is_large(monkeypatch):
    _patch_nlp(monkeypatch)
    base = get_base_stop_words()
    assert len(base) >= 300


def test_worker_output_contract(monkeypatch):
    _patch_nlp(monkeypatch)
    payload = {
        "consultation_id": 100,
        "round_number": 3,
        "transcript": "PTSD and workplace injury were discussed, not employment gaps.",
    }

    result = run_extraction(payload)

    assert "terms" in result
    assert "metadata" in result
    assert isinstance(result["terms"], list)
    assert {"extraction_method", "fallback_used", "reduced_recall"}.issubset(result["metadata"].keys())
