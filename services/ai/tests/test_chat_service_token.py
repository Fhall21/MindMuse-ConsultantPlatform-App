import os
import sys
import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.chat_service_token import create_chat_service_token, verify_chat_service_token
from middleware.chat_service_token import ChatServiceTokenMiddleware


SECRET = "test-secret-at-least-thirty-two-characters-long"


def test_verify_accepts_valid_token():
    token = create_chat_service_token("user-1", "session-1", SECRET)
    claims = verify_chat_service_token(token, SECRET)
    assert claims is not None
    assert claims.user_id == "user-1"
    assert claims.session_id == "session-1"


def test_verify_rejects_expired_token():
    token = create_chat_service_token("user-1", "session-1", SECRET, ttl_ms=-1_000)
    assert verify_chat_service_token(token, SECRET) is None


def test_verify_rejects_tampered_signature():
    token = create_chat_service_token("user-1", "session-1", SECRET)
    encoded, _sig = token.split(".", 1)
    assert verify_chat_service_token(f"{encoded}.bad-signature", SECRET) is None


def test_middleware_blocks_protected_path_without_token(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setenv("BETTER_AUTH_SECRET", SECRET)

    from core.config import Settings

    settings = Settings()
    monkeypatch.setattr("middleware.chat_service_token.settings", settings)

    app = FastAPI()
    app.add_middleware(ChatServiceTokenMiddleware)

    @app.post("/themes/extract")
    async def themes_extract():
        return {"ok": True}

    @app.post("/shorthand/expand")
    async def shorthand_expand():
        return {"ok": True}

    client = TestClient(app)

    assert client.post("/themes/extract", json={}).status_code == 401
    assert client.post("/shorthand/expand", json={}).status_code == 200


def test_middleware_allows_protected_path_with_valid_token(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setenv("BETTER_AUTH_SECRET", SECRET)

    from core.config import Settings

    settings = Settings()
    monkeypatch.setattr("middleware.chat_service_token.settings", settings)

    app = FastAPI()
    app.add_middleware(ChatServiceTokenMiddleware)

    @app.post("/themes/extract")
    async def themes_extract():
        return {"ok": True}

    token = create_chat_service_token("user-1", "session-1", SECRET)
    client = TestClient(app)
    response = client.post(
        "/themes/extract",
        json={},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json() == {"ok": True}
