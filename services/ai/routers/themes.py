import json

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from core.config import settings
from core.learning_adapter import build_personalization_prompt
from core.openai_client import get_client
from models.schemas import ThemeExtractRequest, ThemeExtractResponse

router = APIRouter(prefix="/themes", tags=["themes"])


@router.post("/extract", response_model=ThemeExtractResponse)
async def extract_themes(request: ThemeExtractRequest):
    """Extract key themes from a consultation transcript."""
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")

    client = get_client()

    system_prompt = (
        "You are an expert psychosocial consultation analyst. Your task is to "
        "identify the substantive themes discussed in a consultation transcript.\n\n"
        "A theme is a distinct topic of substance that was meaningfully discussed — "
        "not merely mentioned in passing. Examples of substantive themes include: "
        "workplace stress and its sources, return-to-work barriers, coping strategies "
        "discussed, referral pathways explored, psychosocial hazard identification, "
        "workload and capacity concerns, escalation and support gaps, or change "
        "and system maturity issues.\n\n"
        "Exclude procedural content that does not represent consultation substance: "
        "greetings, scheduling logistics, small talk, administrative housekeeping, "
        "or project status updates that are merely informational.\n\n"
        "For each theme, assess confidence based on how clearly and substantively "
        "the topic was discussed — not just whether a keyword appeared. A theme "
        "mentioned in a single sentence with no elaboration should have lower "
        "confidence than one explored in depth.\n\n"
        "Return between 3 and 8 themes. If the transcript is very short or "
        "ambiguous, return fewer themes with lower confidence rather than "
        "inventing content.\n\n"
        "Return a JSON object with a 'themes' array. Each theme has:\n"
        "- 'label': a short descriptive label (2–6 words, e.g. 'Workplace stress and sources')\n"
        "- 'description': one sentence explaining why this is a theme — what was discussed\n"
        "- 'confidence': float 0.0–1.0 reflecting depth of discussion\n\n"
        "Return only valid JSON, no markdown."
    )

    # Stage 4: inject user-scoped learning context if signals are provided
    personalization = build_personalization_prompt(request.learning_signals)
    if personalization:
        system_prompt += personalization

    completion = client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.transcript},
        ],
        response_format={"type": "json_object"},
    )

    content = completion.choices[0].message.content
    if not content:
        raise HTTPException(status_code=502, detail="Empty response from LLM")

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Model returned invalid JSON: {e}",
        )

    try:
        return ThemeExtractResponse(**parsed)
    except ValidationError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Model output did not match expected schema: {e}",
        )
