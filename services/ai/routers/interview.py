from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Iterable

from fastapi import APIRouter, HTTPException
from openai import APIConnectionError, APIStatusError, RateLimitError

from core.config import settings
from core.openai_client import get_client
from models.schemas import InterviewChatMessage, InterviewChatRequest, InterviewChatResponse

router = APIRouter(prefix="/interview", tags=["interview"])

logger = logging.getLogger(__name__)

COMPLETE_INTERVIEW_TOOL = {
    "type": "function",
    "function": {
        "name": "complete_interview",
        "description": "Call when all topics covered to configured depth, or conversation exceeds 40 turns.",
        "parameters": {
            "type": "object",
            "properties": {
                "topicsCovered": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of topic names that were meaningfully covered.",
                },
                "coverageNote": {
                    "type": "string",
                    "description": "One sentence on overall coverage quality.",
                },
            },
            "required": ["topicsCovered"],
        },
    },
}

TIMEOUT_MESSAGE = "The interview is experiencing a brief pause. Please wait a moment and try again."
REFUSAL_MESSAGE = "I'd like to explore that differently. Could you tell me a bit more about that?"


def _to_message_payloads(messages: Iterable[InterviewChatMessage]) -> list[dict[str, str]]:
    return [message.model_dump() for message in messages]


def _last_assistant_message(messages: list[InterviewChatMessage]) -> str | None:
    for message in reversed(messages):
        if message.role == "assistant" and message.content.strip():
            return message.content.strip()

    return None


def _fallback_message(messages: list[InterviewChatMessage]) -> str:
    last_assistant = _last_assistant_message(messages)
    if last_assistant:
        if last_assistant.endswith("Could you tell me more?"):
            return last_assistant
        return f"{last_assistant} Could you tell me more?"

    return "Could you tell me more?"


def _is_force_complete(messages: list[InterviewChatMessage]) -> bool:
    turn_count = sum(1 for message in messages if message.role in {"user", "assistant"})
    return turn_count >= 80


async def _create_completion(request: InterviewChatRequest) -> InterviewChatResponse:
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")

    client = get_client().with_options(timeout=30.0, max_retries=0)
    messages = _to_message_payloads(request.messages)
    should_force_complete = _is_force_complete(request.messages)
    tool_choice: Any = (
        {"type": "function", "function": {"name": "complete_interview"}}
        if should_force_complete
        else "auto"
    )

    timeout_retried = False
    overload_attempts = 0

    while True:
        try:
            completion = client.chat.completions.create(
                model=settings.openai_model,
                messages=[{"role": "system", "content": request.system_prompt}, *messages],
                tools=request.tools or [COMPLETE_INTERVIEW_TOOL],
                tool_choice=tool_choice,
            )
            break
        except APIConnectionError as exc:
            logger.warning("Interview agent connection issue: %s", exc)
            if timeout_retried:
                raise HTTPException(status_code=503, detail=TIMEOUT_MESSAGE) from exc

            timeout_retried = True
            await asyncio.sleep(3)
        except RateLimitError as exc:
            logger.warning("Interview agent rate limited: %s", exc)
            if overload_attempts >= 3:
                raise HTTPException(status_code=503, detail=TIMEOUT_MESSAGE) from exc

            await asyncio.sleep(2**overload_attempts)
            overload_attempts += 1
        except APIStatusError as exc:
            if exc.status_code != 529:
                raise

            logger.warning("Interview agent overloaded (529): %s", exc)
            if overload_attempts >= 3:
                raise HTTPException(status_code=503, detail=TIMEOUT_MESSAGE) from exc

            await asyncio.sleep(2**overload_attempts)
            overload_attempts += 1

    choice = completion.choices[0]
    message = choice.message
    assistant_message = (message.content or "").strip()
    tool_calls = message.tool_calls or []
    complete_call = next(
        (tool_call for tool_call in tool_calls if tool_call.function.name == "complete_interview"),
        None,
    )

    if complete_call is not None:
        try:
            call_arguments = json.loads(complete_call.function.arguments or "{}")
        except json.JSONDecodeError:
            call_arguments = {}

        topics_covered = call_arguments.get("topicsCovered") or []
        coverage_note = call_arguments.get("coverageNote")
        return InterviewChatResponse(
            assistant_message=assistant_message or "Thank you. That's all I need for today.",
            is_complete=True,
            topics_covered=list(topics_covered),
            coverage_note=coverage_note,
        )

    if getattr(message, "refusal", None):
        logger.info("Interview agent refusal: %s", message.refusal)
        return InterviewChatResponse(
            assistant_message=REFUSAL_MESSAGE,
            is_complete=False,
            topics_covered=[],
        )

    if not assistant_message:
        assistant_message = _fallback_message(request.messages)

    if should_force_complete:
        return InterviewChatResponse(
            assistant_message=assistant_message,
            is_complete=True,
            topics_covered=[],
            coverage_note="Conversation reached the 40-turn limit.",
        )

    return InterviewChatResponse(
        assistant_message=assistant_message,
        is_complete=False,
        topics_covered=[],
    )


@router.post("/chat", response_model=InterviewChatResponse)
async def chat_interview(request: InterviewChatRequest):
    try:
        return await _create_completion(request)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive guard for unexpected SDK issues
        logger.exception("Unexpected interview agent failure")
        raise HTTPException(status_code=502, detail=str(exc)) from exc