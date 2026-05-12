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
        "data": {"session_type": session_type, "status": "running", "stub": True},
    }
    await asyncio.sleep(0)
    yield {
        "type": "complete",
        "data": {"session_type": session_type, "status": "complete", "stub": True},
    }


@router.post("/literature")
async def literature_search(
    _payload: dict[str, Any] = Body(default_factory=dict),
) -> StreamingResponse:
    return await research_event_stream(_stub_research_events("literature"))


@router.post("/analysis")
async def data_analysis(
    _payload: dict[str, Any] = Body(default_factory=dict),
) -> StreamingResponse:
    return await research_event_stream(_stub_research_events("analysis"))
