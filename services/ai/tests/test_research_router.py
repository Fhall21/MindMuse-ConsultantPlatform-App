from __future__ import annotations

import asyncio
import json
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

pytest.importorskip("starlette")

from routers.research import (  # noqa: E402
    _fetch_task_id,
    _parse_storage_fetch_result,
    _read_task_id,
    literature_search,
)


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


# ── Stub path (no Edison key) ─────────────────────────────────────────────────

def test_literature_stub_returns_shared_sse_envelope():
    """Stub path: no session_id needed, no Edison key, returns fake events."""
    async def run():
        with patch("core.config.settings") as mock_settings:
            mock_settings.edison_api_key = None
            response = await literature_search({"query": "burnout"})
            return response, await _collect_stream(response)

    response, stream = asyncio.run(run())
    payloads = _parse_sse_payloads(stream)

    assert response.media_type == "text/event-stream"
    assert [p["type"] for p in payloads] == ["submitted", "polling", "complete"]
    assert payloads[0]["data"]["session_type"] == "literature"
    assert payloads[-1]["data"].get("stub") is True


# ── Coordinator path (Edison key present) ─────────────────────────────────────

def test_literature_no_session_id_yields_error():
    """Production path without session_id: yields error event immediately."""
    async def run():
        with patch("core.config.settings") as mock_settings:
            mock_settings.edison_api_key = "fake-key"
            response = await literature_search({"query": "burnout"})
            return response, await _collect_stream(response)

    response, stream = asyncio.run(run())
    payloads = _parse_sse_payloads(stream)

    assert len(payloads) == 1
    assert payloads[0]["type"] == "error"
    assert "session_id required" in payloads[0]["data"]["message"]


def test_literature_task_id_not_available_yields_error():
    """Worker hasn't written task_id in time: yields error after retries."""
    async def run():
        with patch("core.config.settings") as mock_settings:
            mock_settings.edison_api_key = "fake-key"
            with patch("routers.research._get_db_engine") as mock_engine:
                mock_engine.return_value = MagicMock()
                with patch("routers.research._fetch_task_id", return_value=None):
                    response = await literature_search({"query": "burnout", "session_id": "sess-1"})
                    return response, await _collect_stream(response)

    response, stream = asyncio.run(run())
    payloads = _parse_sse_payloads(stream)

    assert len(payloads) == 1
    assert payloads[0]["type"] == "error"
    assert "worker" in payloads[0]["data"]["message"].lower()


def test_literature_coordinator_success():
    """Coordinator happy path: task_id from DB, Edison returns success."""
    mock_verbose = MagicMock()
    mock_verbose.status = "success"

    async def run():
        with patch("core.config.settings") as mock_settings:
            mock_settings.edison_api_key = "fake-key"
            with patch("routers.research._get_db_engine") as mock_engine:
                mock_engine.return_value = MagicMock()
                with patch("routers.research._fetch_task_id", return_value="task-abc"):
                    with patch("routers.research._extract_literature_payload", return_value={"answer": "x"}):
                        mock_client = MagicMock()
                        mock_client.aget_task = AsyncMock(return_value=mock_verbose)
                        with patch("edison_client.EdisonClient", return_value=mock_client):
                            response = await literature_search({"query": "burnout", "session_id": "sess-1"})
                            return response, await _collect_stream(response)

    response, stream = asyncio.run(run())
    payloads = _parse_sse_payloads(stream)

    types = [p["type"] for p in payloads]
    assert "submitted" in types
    assert types[-1] == "complete"
    assert payloads[-1]["data"] == {"answer": "x"}


def test_literature_coordinator_edison_failure():
    """Edison returns fail status: SSE yields error event."""
    mock_verbose = MagicMock()
    mock_verbose.status = "fail"

    async def run():
        with patch("core.config.settings") as mock_settings:
            mock_settings.edison_api_key = "fake-key"
            with patch("routers.research._get_db_engine") as mock_engine:
                mock_engine.return_value = MagicMock()
                with patch("routers.research._fetch_task_id", return_value="task-abc"):
                    mock_client = MagicMock()
                    mock_client.aget_task = AsyncMock(return_value=mock_verbose)
                    with patch("edison_client.EdisonClient", return_value=mock_client):
                        response = await literature_search({"query": "burnout", "session_id": "sess-1"})
                        return response, await _collect_stream(response)

    response, stream = asyncio.run(run())
    payloads = _parse_sse_payloads(stream)

    assert payloads[-1]["type"] == "error"
    assert "fail" in payloads[-1]["data"]["message"]


def test_literature_coordinator_poll_timeout_retries():
    """Per-poll asyncio.TimeoutError is swallowed and polling continues."""
    call_count = 0

    async def fake_aget_task(*_args, **_kwargs):
        nonlocal call_count
        call_count += 1
        if call_count < 2:
            raise asyncio.TimeoutError
        result = MagicMock()
        result.status = "success"
        return result

    async def run():
        with patch("core.config.settings") as mock_settings:
            mock_settings.edison_api_key = "fake-key"
            with patch("routers.research._get_db_engine") as mock_engine:
                mock_engine.return_value = MagicMock()
                with patch("routers.research._fetch_task_id", return_value="task-abc"):
                    with patch("routers.research._extract_literature_payload", return_value={"answer": "y"}):
                        with patch("asyncio.sleep", new_callable=AsyncMock):
                            mock_client = MagicMock()
                            mock_client.aget_task = fake_aget_task
                            with patch("edison_client.EdisonClient", return_value=mock_client):
                                response = await literature_search({"query": "burnout", "session_id": "sess-1"})
                                return response, await _collect_stream(response)

    response, stream = asyncio.run(run())
    payloads = _parse_sse_payloads(stream)

    assert payloads[-1]["type"] == "complete"
    assert call_count == 2


# ── DB helpers ────────────────────────────────────────────────────────────────

def test_read_task_id_returns_none_when_not_set():
    mock_row = MagicMock()
    mock_row.__getitem__ = lambda self, i: None
    mock_conn = MagicMock()
    mock_conn.__enter__ = lambda s: s
    mock_conn.__exit__ = MagicMock(return_value=False)
    mock_conn.execute.return_value.fetchone.return_value = mock_row
    mock_engine = MagicMock()
    mock_engine.connect.return_value = mock_conn

    result = _read_task_id(mock_engine, "sess-1")
    assert result is None


def test_fetch_task_id_returns_on_first_hit():
    async def run():
        with patch("routers.research._read_task_id", return_value="task-xyz"):
            return await _fetch_task_id(MagicMock(), "sess-1")

    result = asyncio.run(run())
    assert result == "task-xyz"


def test_fetch_task_id_retries_until_available():
    call_count = 0

    def fake_read(_engine, _sid):
        nonlocal call_count
        call_count += 1
        return "task-xyz" if call_count >= 2 else None

    async def run():
        with patch("routers.research._read_task_id", side_effect=fake_read):
            with patch("asyncio.sleep", new_callable=AsyncMock):
                return await _fetch_task_id(MagicMock(), "sess-1")

    result = asyncio.run(run())
    assert result == "task-xyz"
    assert call_count == 2


# ── Storage fetch parser ───────────────────────────────────────────────────────

def test_parse_storage_fetch_result_path(tmp_path):
    artifact = tmp_path / "output.csv"
    artifact.write_text("a,b\n1,2\n", encoding="utf-8")
    content, filename = _parse_storage_fetch_result(artifact)
    assert content == b"a,b\n1,2\n"
    assert filename == "output.csv"


def test_parse_storage_fetch_result_path_list(tmp_path):
    first = tmp_path / "first.csv"
    second = tmp_path / "second.csv"
    first.write_text("one", encoding="utf-8")
    second.write_text("two", encoding="utf-8")
    content, filename = _parse_storage_fetch_result([second, first])
    assert content == b"two"
    assert filename == "second.csv"


def test_parse_storage_fetch_result_raw_fetch_text():
    class RawFetchResponse:
        def __init__(self):
            self.filename = None
            self.content = "hello,world"
            self.entry_name = "results.csv"

    content, filename = _parse_storage_fetch_result(RawFetchResponse())
    assert content == b"hello,world"
    assert filename == "results.csv"


def test_parse_storage_fetch_result_raw_fetch_base64_image():
    import base64

    png_bytes = b"\x89PNG\r\n\x1a\nfake"
    encoded = base64.b64encode(png_bytes).decode("ascii")

    class RawFetchResponse:
        def __init__(self):
            self.filename = "figure_1.png"
            self.content = encoded
            self.entry_name = "figure_1.png"

    content, filename = _parse_storage_fetch_result(RawFetchResponse())
    assert content == png_bytes
    assert filename == "figure_1.png"


def test_parse_storage_fetch_result_none():
    assert _parse_storage_fetch_result(None) == (None, None)
