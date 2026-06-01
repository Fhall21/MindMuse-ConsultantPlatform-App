import json

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from core.config import settings
from core.openai_client import get_client
from models.schemas import QuoteIdentifyRequest, QuoteIdentifyResponse

router = APIRouter(prefix="/quotes", tags=["quotes"])


@router.post("/identify", response_model=QuoteIdentifyResponse)
async def identify_quotes(body: QuoteIdentifyRequest):
    """Extract verbatim quotes from a transcript linked to confirmed insights."""
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")

    if not body.themes:
        raise HTTPException(status_code=422, detail="At least one theme is required")

    theme_lines = "\n".join(
        f"- id: {theme.id} | label: {theme.label}" for theme in body.themes
    )

    system_prompt = (
        "You are an expert qualitative research analyst. Extract verbatim quotes from "
        "the transcript that directly support the listed insights (themes).\n\n"
        "Rules:\n"
        "- Return ONLY exact verbatim text from the transcript — do not paraphrase.\n"
        "- Each quote MUST link to exactly one theme_id from the provided list.\n"
        "- Include speaker when clearly identifiable from the transcript.\n"
        "- Prefer concise, high-signal quotes (1–4 sentences each).\n"
        "- Return 1–3 quotes per theme when evidence exists; skip themes with no support.\n"
        "- span_start and span_end are optional character offsets into the transcript.\n\n"
        "Return JSON: {\"quotes\": [{\"text\": \"...\", \"speaker\": \"...\"|null, "
        "\"theme_id\": \"uuid\", \"span_start\": int|null, \"span_end\": int|null}]}\n"
        "Return ONLY valid JSON. Do NOT wrap in markdown."
    )

    user_prompt = (
        f"INSIGHTS:\n{theme_lines}\n\nTRANSCRIPT:\n{body.transcript}"
    )

    client = get_client()
    completion = client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
    )

    content = completion.choices[0].message.content
    if not content:
        raise HTTPException(status_code=502, detail="Empty response from LLM")

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Model returned invalid JSON: {exc}",
        ) from exc

    try:
        return QuoteIdentifyResponse(**parsed)
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Model output did not match expected schema: {exc}",
        ) from exc
