import json

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from core.config import settings
from core.openai_client import get_client
from models.schemas import ShorthandExpandRequest, ShorthandExpandResponse

router = APIRouter(prefix="/shorthand", tags=["shorthand"])

SYSTEM_PROMPT = (
    "You are an expert at interpreting handwritten psychosocial consultation notes "
    "that contain shorthand, abbreviations, and compressed phrasing.\n\n"
    "Your task is to expand the provided text into clear, full English sentences "
    "while preserving the exact meaning and clinical intent. Do not add information "
    "that is not implied by the original text.\n\n"
    "Common consultation shorthand patterns to handle:\n"
    "- Single letters or abbreviations for people (e.g. 'P' = person, 'C' = consultant, "
    "'Mgr' = manager, 'HR' = human resources)\n"
    "- Action abbreviations (e.g. 'f/u' = follow up, 'ref' = referred/referral, "
    "'appt' = appointment, 'w/' = with, 'r/e' = regarding)\n"
    "- Clinical terms (e.g. 'WRB' = work-related barriers, 'EAP' = Employee Assistance "
    "Programme, 'RTW' = return to work, 'OHS' = occupational health and safety)\n"
    "- Symbols (e.g. '→' = leads to/results in, '↑' = increased, '↓' = decreased, "
    "'~' = approximately, '+' = and/also, '?' = uncertain/queried)\n\n"
    "Write all output in Australian English (e.g., 'organisation' not 'organization', "
    "'analyse' not 'analyze', 'colour' not 'color').\n\n"
    "Return a JSON object with exactly these fields:\n"
    "- 'expanded_text' (string): the full expanded text, preserving paragraph structure\n"
    "- 'changes' (array): each change made, with:\n"
    "  - 'original' (string): the original shorthand token or phrase\n"
    "  - 'expanded' (string): the expanded form used\n"
    "  - 'reason' (string): brief explanation of the interpretation\n\n"
    "If a token is ambiguous, choose the most plausible interpretation given context "
    "and note the ambiguity in the reason field.\n"
    "If the text is already fully written out (no shorthand), return it unchanged with "
    "an empty changes array.\n\n"
    "Return only valid JSON, no markdown fences."
)


@router.post("/expand", response_model=ShorthandExpandResponse)
async def expand_shorthand(request: ShorthandExpandRequest):
    """
    Expand shorthand consultation notes into full readable text.

    Takes raw OCR/typed shorthand text and returns an expanded version
    along with a log of each change made and the reasoning.
    """
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")

    if not request.raw_text.strip():
        raise HTTPException(status_code=422, detail="raw_text must not be empty")

    context_note = (
        f"\nConsultation context: {request.context}"
        if request.context
        else ""
    )

    user_content = (
        f"Expand the following consultation shorthand into full text.{context_note}\n\n"
        f"Text to expand:\n{request.raw_text}"
    )

    client = get_client()

    completion = client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
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
        return ShorthandExpandResponse(**parsed)
    except ValidationError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Model output did not match expected schema: {e}",
        )
