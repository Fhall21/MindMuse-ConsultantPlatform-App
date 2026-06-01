"""HMAC service tokens for chat agent → FastAPI tool dispatch.

Must match Next.js lib/chat/service-token.ts (BETTER_AUTH_SECRET, 5min TTL).
"""

from __future__ import annotations

import base64
import hmac
import hashlib
import time
from dataclasses import dataclass


@dataclass(frozen=True)
class ChatServiceTokenClaims:
    user_id: str
    session_id: str


def _sign_payload(payload: str, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def _decode_payload(encoded: str) -> str | None:
    try:
        padding = "=" * (-len(encoded) % 4)
        return base64.urlsafe_b64decode(encoded + padding).decode("utf-8")
    except (ValueError, UnicodeDecodeError):
        return None


def verify_chat_service_token(token: str, secret: str) -> ChatServiceTokenClaims | None:
    if not token or not secret:
        return None

    parts = token.split(".", 1)
    if len(parts) != 2:
        return None

    encoded_payload, signature = parts
    payload = _decode_payload(encoded_payload)
    if payload is None:
        return None

    expected = _sign_payload(payload, secret)
    if not hmac.compare_digest(signature, expected):
        return None

    segments = payload.split(":")
    if len(segments) != 3:
        return None

    user_id, session_id, exp_raw = segments
    if not user_id or not session_id:
        return None

    try:
        exp_ms = int(exp_raw)
    except ValueError:
        return None

    if time.time() * 1000 > exp_ms:
        return None

    return ChatServiceTokenClaims(user_id=user_id, session_id=session_id)


def create_chat_service_token(
    user_id: str,
    session_id: str,
    secret: str,
    *,
    ttl_ms: int = 5 * 60 * 1000,
) -> str:
    """Test helper — mirrors Next.js createChatServiceToken."""
    exp = int(time.time() * 1000) + ttl_ms
    payload = f"{user_id}:{session_id}:{exp}"
    encoded = base64.urlsafe_b64encode(payload.encode("utf-8")).decode("ascii").rstrip("=")
    return f"{encoded}.{_sign_payload(payload, secret)}"
