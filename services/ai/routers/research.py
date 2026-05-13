from __future__ import annotations

import asyncio
import json
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


# Synthetic reasoning steps shown to the user while Edison processes.
_REASONING_STEPS = [
    {"label": "Submitting query", "detail": "Research question sent to Edison Scientific."},
    {"label": "Retrieving papers", "detail": "Searching scientific literature databases…"},
    {"label": "Analysing sources", "detail": "Evaluating relevance and quality of retrieved papers…"},
    {"label": "Writing answer", "detail": "Synthesising findings into a cited response…"},
]


def _extract_literature_payload(task_result: Any, verbose_result: Any) -> dict[str, Any]:
    answer_text: str = getattr(task_result, "answer", "") or ""

    references: list[dict[str, Any]] = []
    try:
        raw_refs = verbose_result.environment_frame["state"]["state"]["response"]["answer"]["references"]
        for i, ref in enumerate(raw_refs, start=1):
            if not isinstance(ref, dict):
                continue
            references.append({
                "number": i,
                "title": ref.get("title") or ref.get("citation") or f"Reference {i}",
                "authors": ref.get("authors") or ref.get("author") or "",
                "year": str(ref.get("year") or ref.get("date") or ""),
                "journal": ref.get("journal") or ref.get("source") or ref.get("venue") or "",
                "url": ref.get("url") or ref.get("doi") or "",
            })
    except (KeyError, TypeError, AttributeError):
        pass

    return {
        "answer": answer_text,
        "reasoning_steps": _REASONING_STEPS,
        "references": references,
    }


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
        # Advance synthetic steps: one new step roughly every 20 s, capped at last step.
        step_count = min(len(_REASONING_STEPS), elapsed // 20 + 2)
        visible_steps = _REASONING_STEPS[:step_count]

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
            yield {
                "type": "polling",
                "data": {"elapsed_seconds": elapsed, "reasoning_steps": visible_steps},
            }


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
        "data": {
            "session_type": session_type,
            "stub": True,
            "elapsed_seconds": 0,
            "reasoning_steps": _REASONING_STEPS[:2],
        },
    }
    await asyncio.sleep(0)
    yield {
        "type": "complete",
        "data": {
            "session_type": session_type,
            "stub": True,
            "answer": (
                "Social science consulting relies on evidence-based methods. [1] "
                "Structured interviews are a core tool for gathering qualitative data. [2] "
                "Thematic analysis enables systematic interpretation of interview findings."
            ),
            "reasoning_steps": _REASONING_STEPS,
            "references": [
                {
                    "number": 1,
                    "title": "Qualitative Research in Social Science Practice",
                    "authors": "Smith, J. & Jones, A.",
                    "year": "2023",
                    "journal": "Journal of Social Science Methods",
                    "url": "",
                },
                {
                    "number": 2,
                    "title": "Thematic Analysis: A Practical Guide",
                    "authors": "Braun, V. & Clarke, V.",
                    "year": "2022",
                    "journal": "Qualitative Research in Psychology",
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
