"""Fixture-driven contract test for the literature payload extractor.

The fixture at tests/fixtures/edison_literature_complete.json is a real
Edison verbose response captured from a completed research session
(task 3f1d000c-…). Treat it as the source of truth for the SSE
`complete` payload schema. If this test breaks, it means the payload
shape changed — update the fixture deliberately AND check that the
frontend types in hooks/use-research.ts still line up.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from routers.research import _extract_literature_payload

FIXTURE = Path(__file__).parent / "fixtures" / "edison_literature_complete.json"


class _Verbose:
    """Thin wrapper that gives attribute access to the dict fields the
    extractor reads from a real `TaskResponseVerbose`."""
    def __init__(self, data: dict):
        self.environment_frame = data.get("environment_frame")
        self.agent_state = data.get("agent_state")
        self.answer = (
            (data.get("environment_frame") or {})
            .get("state", {})
            .get("state", {})
            .get("response", {})
            .get("answer", {})
            .get("answer", "")
        )


@pytest.fixture(scope="module")
def payload() -> dict:
    if not FIXTURE.exists():
        pytest.skip("Edison fixture not present")
    with FIXTURE.open() as f:
        raw = json.load(f)
    return _extract_literature_payload(_Verbose(raw))


def test_stats_come_from_edisons_own_status_trailer(payload):
    """The Status: trailer Edison appends to tool results is the source
    of truth — these are the exact numbers Edison's own UI shows."""
    s = payload["stats"]
    # Final tally for the CBT-workplace-stress fixture.
    assert s == {
        "paper_count": 69,
        "relevant_papers": 11,
        "clinical_trial_count": 0,
        "relevant_clinical_trials": 0,
        "current_evidence": 34,
        "disease_target_evidence": 0,
    }


def test_reference_strength_from_edisons_phrasing(payload):
    """Edison embeds its own strength phrase in the references string;
    we surface it as ReferenceStrength."""
    refs = payload["references"]
    strengths = {r["strength"] for r in refs if r.get("strength")}
    # The fixture contains both 'domain leading' and 'highest quality' tiers.
    assert "DOMAIN_LEADING" in strengths or "HIGHEST_QUALITY" in strengths
    # Every reference has a citation_count parsed.
    for r in refs:
        assert "citation_count" in r and isinstance(r["citation_count"], int)


def test_reference_context_usage_uses_dotted_format(payload):
    """Per the Edison platform UI, context labels are `{ref}.{idx}`."""
    refs = payload["references"]
    sample = next((r for r in refs if r.get("contexts_used")), None)
    assert sample is not None
    for label in sample["contexts_used"] + sample.get("contexts_unused", []):
        assert label.startswith(f"{sample['number']}.")


def test_evidence_has_source_reference(payload):
    """Each evidence excerpt resolves to a numbered reference."""
    ev = payload["evidence"]
    assert len(ev) > 0
    # The top excerpt by score should carry source_ref_number + title.
    top = ev[0]
    assert "source_ref_number" in top
    assert "source_title" in top
    assert isinstance(top["source_ref_number"], int)


def test_reasoning_steps_carry_structured_data(payload):
    by_label = {s["label"]: s for s in payload["reasoning_steps"]}

    plan = by_label["Planning research"]
    assert plan["data"]["kind"] == "plan"
    rows = plan["data"]["rows"]
    assert len(rows) >= 5
    # Status must be one of the three known values.
    for r in rows:
        assert r["status"] in {"COMPLETED", "IN-PROGRESS", "PENDING"}

    search = by_label["Searching literature"]
    assert search["data"]["kind"] == "search"
    queries = search["data"]["queries"]
    assert len(queries) >= 1
    p0 = queries[0]["papers"][0]
    assert p0["title"]
    # Bibtex-derived metadata is present on at least one paper.
    assert any(("year" in p and p["year"]) for q in queries for p in q["papers"])
    assert any(("journal" in p and p["journal"]) for q in queries for p in q["papers"])

    gather = by_label["Gathering evidence"]
    assert gather["data"]["kind"] == "gather"
    rounds = gather["data"]["rounds"]
    assert len(rounds) >= 1
    # Each round carries structured excerpts with citation metadata.
    for r in rounds:
        assert "question" in r and r["question"]
        for ex in r["top_excerpts"]:
            assert "excerpt" in ex
            # citation_count populated when Edison emitted "This article has N
            # citations" — most excerpts have this.
            assert "source_citation_key" in ex

    figures = by_label.get("Reviewing figures")
    if figures:
        assert figures["data"]["kind"] == "figures"
        for r in figures["data"]["rounds"]:
            assert r["citation_key"]
            assert r["image_count"] >= 1


def test_figure_rounds_carry_inline_images(payload):
    """view_images tool results should preserve image_url data URLs."""
    figures_step = next(
        (s for s in payload["reasoning_steps"] if s.get("label") == "Reviewing figures"),
        None,
    )
    assert figures_step is not None
    rounds = figures_step["data"]["rounds"]
    rounds_with_images = [r for r in rounds if r.get("images")]
    assert len(rounds_with_images) >= 1
    for rnd in rounds_with_images:
        assert len(rnd["images"]) >= 1
        assert rnd["image_count"] == len(rnd["images"])
        for img in rnd["images"]:
            assert img["url"].startswith("data:image/")


def test_payload_includes_top_level_figures(payload):
    """Flattened figures list powers the Figures tab."""
    assert "figures" in payload
    assert len(payload["figures"]) >= 1
    for fig in payload["figures"]:
        assert fig["id"]
        assert fig["url"].startswith("data:image/")
        assert fig["citation_key"]


def test_artifact_step_carries_stats_footer(payload):
    artifact = next(
        (s for s in payload["reasoning_steps"]
         if s.get("data", {}).get("kind") == "artifact"),
        None,
    )
    assert artifact is not None
    data = artifact["data"]
    assert "table_markdown" in data
    assert data["table_markdown"].startswith("|")
    # Stats are attached to the artifact step too — so the Reasoning tab can
    # show the same numbers footer Edison shows below its synthesis table.
    assert data["stats"]["relevant_papers"] == 11


def test_payload_schema_keys_match_frontend_contract(payload):
    """Top-level keys are the SSE `complete` payload contract."""
    expected = {"answer", "reasoning_steps", "references", "evidence", "artifact", "stats"}
    assert set(payload.keys()) >= expected - {"stats"}
    # `stats` is only present when derivable; the fixture always has it.
    assert "stats" in payload
