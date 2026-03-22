import json

from fastapi import APIRouter, HTTPException

from core.config import settings
from core.openai_client import get_client
from models.schemas import MeetingMetadataInferRequest, MeetingMetadataInferResponse

router = APIRouter(prefix="/infer", tags=["infer"])

SYSTEM_PROMPT = (
    "You are an expert at extracting structured metadata from consultation transcripts.\n\n"
    "Given a transcript, extract the following:\n"
    "1. meeting_type_code — the type of meeting. Choose one of the provided codes if the "
    "context makes it clear (e.g. '1-1' for a one-on-one interview, 'FC' for a focus group/panel). "
    "Return null if no codes are provided or the type is unclear.\n"
    "2. suggested_date — the date the meeting took place. Return as ISO date (YYYY-MM-DD) "
    "if a date is mentioned or clearly implied in the transcript; otherwise null.\n"
    "3. suggested_people — a list of participant names (interviewees, group members, speakers). "
    "Exclude the consultant/interviewer if their role is clear. Return an empty list if "
    "no names can be reliably identified.\n\n"
    "Write all output in Australian English (e.g., 'organisation' not 'organization', "
    "'analyse' not 'analyze', 'colour' not 'color').\n\n"
    "Return only valid JSON with exactly these keys:\n"
    '{"suggested_type_code": string|null, "suggested_date": string|null, "suggested_people": string[]}'
)

# Transcript is capped to avoid token blowout; first 12 000 chars covers ~3 000 words
TRANSCRIPT_CHAR_LIMIT = 12_000


@router.post("/meeting-metadata", response_model=MeetingMetadataInferResponse)
async def infer_meeting_metadata(request: MeetingMetadataInferRequest):
    """
    Extract meeting metadata (type, date, participants) from a transcript.

    Returns best-effort suggestions — the caller shows them in an editable form
    for the user to review and correct before saving.
    """
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")

    if not request.transcript.strip():
        raise HTTPException(status_code=422, detail="Transcript is empty")

    type_codes_note = ""
    if request.meeting_type_codes:
        codes = ", ".join(f'"{c}"' for c in request.meeting_type_codes)
        type_codes_note = (
            f"\nAvailable meeting type codes: {codes}. "
            "Use one of these exact strings for suggested_type_code if appropriate."
        )

    user_content = (
        f"Extract meeting metadata from this transcript.{type_codes_note}\n\n"
        f"Transcript:\n{request.transcript[:TRANSCRIPT_CHAR_LIMIT]}"
    )

    client = get_client()

    try:
        completion = client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM API error: {e}")

    content = completion.choices[0].message.content
    if not content:
        raise HTTPException(status_code=502, detail="Empty response from LLM")

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=422, detail=f"Model returned invalid JSON: {e}")

    # Validate the suggested_type_code is one of the provided codes (or null it out)
    raw_code = parsed.get("suggested_type_code")
    valid_code = (
        raw_code
        if isinstance(raw_code, str) and raw_code in request.meeting_type_codes
        else None
    )

    # Validate date looks like YYYY-MM-DD
    raw_date = parsed.get("suggested_date")
    valid_date: str | None = None
    if isinstance(raw_date, str) and len(raw_date) == 10 and raw_date[4] == "-":
        valid_date = raw_date

    people = [
        name.strip()
        for name in (parsed.get("suggested_people") or [])
        if isinstance(name, str) and name.strip()
    ]

    return MeetingMetadataInferResponse(
        suggested_type_code=valid_code,
        suggested_date=valid_date,
        suggested_people=people,
    )
