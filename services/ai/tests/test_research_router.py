from __future__ import annotations

import json
import os
import sys
import asyncio

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

pytest.importorskip("starlette")

from routers.research import literature_search  # noqa: E402


async def _collect_stream(response):
    chunks: list[str] = []
    async for chunk in response.body_iterator:
        chunks.append(chunk.decode() if isinstance(chunk, bytes) else chunk)
    return "".join(chunks)


def _parse_sse_payloads(stream: str):
    payloads = []
    for frame in stream.strip().split("\n\n"):
        assert frame.startswith("data: ")
        payloads.append(json.loads(frame.removeprefix("data: ")))
    return payloads


def test_literature_stub_returns_shared_sse_envelope():
    async def run():
        response = await literature_search({"query": "burnout"})
        return response, await _collect_stream(response)

    response, stream = asyncio.run(run())
    payloads = _parse_sse_payloads(stream)

    assert response.media_type == "text/event-stream"
    assert [payload["type"] for payload in payloads] == [
        "submitted",
        "polling",
        "complete",
    ]
    assert payloads[0]["data"]["session_type"] == "literature"
    assert payloads[-1]["data"]["status"] == "complete"
