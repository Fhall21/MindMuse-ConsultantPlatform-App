from __future__ import annotations

import asyncio
import json
import re
from collections.abc import AsyncIterator
from typing import Any, Literal, TypedDict

from fastapi import APIRouter, Body
from starlette.responses import StreamingResponse


ResearchEventType = Literal["submitted", "polling", "complete", "error"]


class ResearchEvent(TypedDict):
    type: ResearchEventType
    data: dict[str, Any]


router = APIRouter(prefix="/research", tags=["research"])


def _sse_frame(event: ResearchEvent) -> str:
    return f"data: {json.dumps(event, separators=(',', ':'))}\n\n"


async def research_event_stream(
    events: AsyncIterator[ResearchEvent],
) -> StreamingResponse:
    async def stream() -> AsyncIterator[str]:
        async for event in events:
            yield _sse_frame(event)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )


# ── Edison response parsing ───────────────────────────────────────────────────

def _parse_references_string(refs_str: str) -> list[dict[str, Any]]:
    """Parse Edison's numbered reference string into a deduplicated list.

    Edison emits the same paper multiple times (different page ranges).
    We deduplicate by title and re-number from 1.
    """
    if not refs_str:
        return []

    ref_pattern = re.compile(
        r"\d+\.\s+\(([^)]+)\):\s+(.*?)(?=\n\d+\.\s+\(|\Z)",
        re.DOTALL,
    )

    seen_titles: dict[str, int] = {}
    result: list[dict[str, Any]] = []

    for m in ref_pattern.finditer(refs_str):
        key_pages = m.group(1)
        rest = m.group(2).strip()

        key_match = re.match(r"(\S+)\s+pages", key_pages)
        citation_key = key_match.group(1) if key_match else key_pages

        url_match = re.search(r"URL:\s*(https?://[^\s,]+)", rest)
        url = url_match.group(1) if url_match else ""
        doi_match = re.search(r"doi:(\S+?)(?:\s|$)", rest)
        if not url and doi_match:
            url = f"https://doi.org/{doi_match.group(1)}"

        year_match = re.search(r"\b(20\d{2}|19\d{2})\b", rest)
        year = year_match.group(1) if year_match else ""

        pre_url = rest[: url_match.start()].rstrip("., ") if url_match else rest

        # Anchor on "Journal, Volume:Pages" to cleanly split title from journal.
        vol_match = re.search(r",\s*\d+:\d+-\d+", pre_url)
        authors = title = journal = ""
        if vol_match:
            before_journal = pre_url[: vol_match.start()]
            last_dot = before_journal.rfind(". ")
            if last_dot >= 0:
                journal = before_journal[last_dot + 2:].strip()
                pre_title = before_journal[:last_dot]
                # Split authors / title at first non-initial sentence boundary.
                boundary = re.search(r"(?<![A-Z])\.(?<!\b[A-Z])[ ]+(?=[A-Z])", pre_title)
                if boundary:
                    authors = pre_title[: boundary.start()].strip()
                    title = pre_title[boundary.end():].strip()
                else:
                    title = pre_title.strip()
            else:
                journal = before_journal.strip()
        else:
            parts = pre_url.split(". ", 2)
            authors = parts[0].strip() if parts else ""
            title = parts[1].strip() if len(parts) > 1 else ""
            journal = parts[2].strip() if len(parts) > 2 else ""

        if not title or title in seen_titles:
            continue

        seen_titles[title] = len(result) + 1
        result.append(
            {
                "number": len(result) + 1,
                "citation_key": citation_key,
                "title": title,
                "authors": authors,
                "year": year,
                "journal": journal,
                "url": url,
            }
        )

    return result


def _replace_inline_citations(answer_text: str, key_to_num: dict[str, int]) -> str:
    """Replace (citationkey pages X-Y, ...) groups with [N, M] markers."""

    def replace_group(m: re.Match) -> str:  # type: ignore[type-arg]
        keys = re.findall(r"(\S+)\s+pages\s+[\d\-]+", m.group(1))
        numbers = sorted({key_to_num[k] for k in keys if k in key_to_num})
        return (" [" + ", ".join(str(n) for n in numbers) + "]") if numbers else m.group(0)

    return re.sub(r"\s*\(([^)]+\bpages\b[^)]+)\)", replace_group, answer_text)


_TOOL_LABELS: dict[str, tuple[str, str]] = {
    "create_plan": ("Planning research", "Creating a structured plan for the research query."),
    "paper_search": ("Searching literature", "Querying scientific databases for relevant papers."),
    "gather_evidence": ("Gathering evidence", "Collecting key excerpts from retrieved papers."),
    "read_text": ("Reading sources", "Reviewing and evaluating paper content in detail."),
    "view_images": ("Reviewing figures", "Examining figures, tables, and diagrams from sources."),
    "create_artifact": ("Synthesising findings", "Structuring retrieved evidence into a coherent summary."),
    "answer": ("Writing answer", "Composing the final cited, evidence-grounded response."),
}


def _tool_history_to_steps(tool_history: list[Any]) -> list[dict[str, str]]:
    seen: set[str] = set()
    steps: list[dict[str, str]] = []
    for entry in tool_history:
        if isinstance(entry, list):
            for tool in entry:
                if tool not in seen and tool in _TOOL_LABELS:
                    seen.add(tool)
                    label, detail = _TOOL_LABELS[tool]
                    steps.append({"label": label, "detail": detail})
    return steps


def _extract_literature_payload(task_result: Any, verbose_result: Any) -> dict[str, Any]:
    """Build the payload dict from a completed Edison PQATaskResponse."""
    raw_answer: str = getattr(task_result, "answer", "") or ""
    references: list[dict[str, Any]] = []
    reasoning_steps: list[dict[str, str]] = []

    try:
        inner = verbose_result.environment_frame["state"]["state"]["response"]["answer"]

        refs_str: str = inner.get("references", "") or ""
        references = _parse_references_string(refs_str)

        tool_history: list[Any] = inner.get("tool_history", [])
        reasoning_steps = _tool_history_to_steps(tool_history)
    except (KeyError, TypeError, AttributeError):
        pass

    key_to_num = {r["citation_key"]: r["number"] for r in references}
    answer = _replace_inline_citations(raw_answer, key_to_num) if key_to_num else raw_answer

    return {
        "answer": answer,
        "reasoning_steps": reasoning_steps,
        "references": references,
    }


# ── SSE generators ────────────────────────────────────────────────────────────

async def _run_literature_sse(query: str, industry_ctx: str | None) -> AsyncIterator[ResearchEvent]:
    from ..core.config import settings

    if not settings.edison_api_key:
        async for event in _stub_research_events("literature"):
            yield event
        return

    from edison_client import EdisonClient, JobNames  # type: ignore[import]

    client = EdisonClient(api_key=settings.edison_api_key)
    full_query = f"[Industry context: {industry_ctx}]\n\n{query}" if industry_ctx else query

    try:
        task_id: str = await asyncio.to_thread(
            client.create_task, {"name": JobNames.LITERATURE, "query": full_query}
        )
    except Exception as exc:
        yield {"type": "error", "data": {"message": f"Failed to submit Edison task: {exc}"}}
        return

    yield {"type": "submitted", "data": {"task_id": task_id}}

    start = asyncio.get_event_loop().time()

    while True:
        await asyncio.sleep(5)

        try:
            result = await asyncio.to_thread(client.get_task, task_id)
        except Exception as exc:
            yield {"type": "error", "data": {"message": f"Polling error: {exc}"}}
            return

        elapsed = int(asyncio.get_event_loop().time() - start)

        if result.status == "success":
            try:
                verbose_result = await asyncio.to_thread(client.get_task, task_id, True)
            except Exception:
                verbose_result = result
            payload = _extract_literature_payload(result, verbose_result)
            yield {"type": "complete", "data": payload}
            return
        elif result.status not in {"queued", "in progress"}:
            yield {
                "type": "error",
                "data": {"message": f"Edison task ended with status: {result.status}"},
            }
            return
        else:
            yield {"type": "polling", "data": {"elapsed_seconds": elapsed}}


async def _stub_research_events(
    session_type: Literal["literature", "analysis"],
) -> AsyncIterator[ResearchEvent]:
    yield {
        "type": "submitted",
        "data": {"session_type": session_type, "stub": True},
    }
    await asyncio.sleep(0)
    yield {
        "type": "polling",
        "data": {"session_type": session_type, "stub": True, "elapsed_seconds": 5},
    }
    await asyncio.sleep(0)
    yield {
        "type": "complete",
        "data": {
            "session_type": session_type,
            "stub": True,
            "answer": (
                "Social science consulting relies on evidence-based methods. [1]\n\n"
                "## Structured interviews\n\n"
                "Structured interviews are a core tool for gathering qualitative data in consulting contexts. [2]\n\n"
                "## Thematic analysis\n\n"
                "Thematic analysis enables systematic interpretation of interview findings, "
                "producing actionable insights from complex data. [1, 2]"
            ),
            "reasoning_steps": [
                {"label": "Planning research", "detail": "Creating a structured plan for the research query."},
                {"label": "Searching literature", "detail": "Querying scientific databases for relevant papers."},
                {"label": "Gathering evidence", "detail": "Collecting key excerpts from retrieved papers."},
                {"label": "Writing answer", "detail": "Composing the final cited, evidence-grounded response."},
            ],
            "references": [
                {
                    "number": 1,
                    "citation_key": "braun2006",
                    "title": "Using thematic analysis in psychology",
                    "authors": "Virginia Braun and Victoria Clarke",
                    "year": "2006",
                    "journal": "Qualitative Research in Psychology",
                    "url": "https://doi.org/10.1191/1478088706qp063oa",
                },
                {
                    "number": 2,
                    "citation_key": "smith2023",
                    "title": "Evidence-based practice in social science consulting",
                    "authors": "Smith, J. & Jones, A.",
                    "year": "2023",
                    "journal": "Journal of Consulting Research",
                    "url": "",
                },
            ],
        },
    }


@router.post("/literature")
async def literature_search(
    payload: dict[str, Any] = Body(default_factory=dict),
) -> StreamingResponse:
    query: str = payload.get("query", "")
    industry_ctx: str | None = payload.get("industry_ctx") or None
    return await research_event_stream(_run_literature_sse(query, industry_ctx))


@router.post("/analysis")
async def data_analysis(
    _payload: dict[str, Any] = Body(default_factory=dict),
) -> StreamingResponse:
    return await research_event_stream(_stub_research_events("analysis"))
