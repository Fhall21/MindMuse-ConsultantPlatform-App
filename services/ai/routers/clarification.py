import json

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from core.config import settings
from core.openai_client import get_client
from models.schemas import ClarificationRequest, ClarificationResponse

router = APIRouter(prefix="/clarification", tags=["clarification"])


@router.post("/questions", response_model=ClarificationResponse)
async def generate_clarification_questions(request: ClarificationRequest):
    """Generate targeted follow-up questions to enrich a consultation record."""
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")

    client = get_client()

    themes_str = ", ".join(request.themes) if request.themes else "none identified yet"
    context = f"\nConsultant's additional notes:\n{request.context_notes}" if request.context_notes else ""
    ocr_section = f"\nHandwritten note content (OCR extracted):\n{request.ocr_text}" if request.ocr_text else ""

    system_prompt = (
        "You are a psychosocial consultation quality analyst. A consultant has "
        "completed a consultation. They may have provided a transcript, handwritten "
        "note extracts (OCR), or both. Themes have been extracted, but the record "
        "may be incomplete or ambiguous.\n\n"
        "Your task is to generate 3–6 targeted questions that help the "
        "consultant strengthen their evidence record before drafting the "
        "follow-up email. These are questions for the consultant to reflect on "
        "and answer — not questions to ask the person they consulted.\n\n"
        "Each question has a type:\n"
        "- 'confirm': asks the consultant to confirm something implied in the "
        "transcript but not stated explicitly (e.g. 'Was a referral to EAP "
        "agreed upon, or only discussed as an option?')\n"
        "- 'expand': asks for more detail on a theme that was mentioned but "
        "not elaborated (e.g. 'Can you describe the specific workload concerns "
        "that were raised?')\n"
        "- 'missing': flags something typically present in this kind of "
        "consultation that was not mentioned at all (e.g. 'Were any follow-up "
        "actions or timeframes agreed upon?')\n\n"
        "Questions should be:\n"
        "- Specific and answerable in 1–2 sentences\n"
        "- Grounded in what the transcript says or notably omits\n"
        "- Useful for strengthening the evidence quality of the record\n"
        "- Not redundant with what is already clearly stated\n\n"
        "Return a JSON object with a 'questions' array. Each question has:\n"
        "- 'question': the question text\n"
        "- 'type': one of 'confirm', 'expand', or 'missing'\n"
        "- 'theme_label': the theme it relates to (null if it relates to the "
        "consultation overall rather than a specific theme)\n\n"
        "Return only valid JSON, no markdown."
    )

    user_content = (
        f"Themes identified so far: {themes_str}\n"
        f"{context}"
        f"{ocr_section}\n\n"
        f"Transcript:\n{request.transcript}"
    )

    completion = client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": system_prompt},
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
        return ClarificationResponse(**parsed)
    except ValidationError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Model output did not match expected schema: {e}",
        )
