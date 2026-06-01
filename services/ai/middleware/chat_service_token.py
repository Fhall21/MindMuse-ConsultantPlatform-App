from __future__ import annotations

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from core.chat_protected_paths import CHAT_PROTECTED_PATHS
from core.chat_service_token import verify_chat_service_token
from core.config import settings

logger = logging.getLogger(__name__)


class ChatServiceTokenMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path

        if request.method == "OPTIONS" or path not in CHAT_PROTECTED_PATHS:
            return await call_next(request)

        if not settings.better_auth_secret:
            logger.error("[chat-auth] BETTER_AUTH_SECRET missing — rejecting protected path %s", path)
            return JSONResponse(
                {"detail": "Chat service token validation is not configured"},
                status_code=503,
            )

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse({"detail": "Unauthorized"}, status_code=401)

        token = auth_header[7:].strip()
        claims = verify_chat_service_token(token, settings.better_auth_secret)
        if claims is None:
            return JSONResponse({"detail": "Invalid or expired service token"}, status_code=401)

        request.state.chat_user_id = claims.user_id
        request.state.chat_session_id = claims.session_id
        return await call_next(request)
