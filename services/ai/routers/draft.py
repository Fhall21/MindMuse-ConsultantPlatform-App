import json

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from core.config import settings
from core.openai_client import get_client
from models.schemas import EmailDraftRequest, EmailDraftResponse

router = APIRouter(prefix="/draft", tags=["draft"])


@router.post("/email", response_model=EmailDraftResponse)
async def draft_email(request: EmailDraftRequest):
    """Generate an evidence email draft from consultation data."""
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")

    client = get_client()

    people_str = ", ".join(request.people) if request.people else "the participants"
    themes_str = ", ".join(request.themes) if request.themes else "the topics discussed"
    title = request.consultation_title or "the consultation"
    date_str = f" on {request.consultation_date}" if request.consultation_date else ""

    system_prompt = (
        "You are a psychosocial consultation evidence email writer. You write "
        "professional, first-person follow-up emails from a consultant to the "
        "person they consulted with. The email serves as an auditable evidence "
        "artifact — it must make clear what was discussed, not just that a "
        "meeting occurred.\n\n"
        "Structure the email as follows:\n"
        "1. Greeting addressed to the first person listed\n"
        "2. Opening line confirming the consultation took place, including the "
        "date if provided\n"
        "3. A brief acknowledgment of the person's role or context if apparent "
        "from the transcript\n"
        "4. Key themes discussed, presented as themed sections. Each theme "
        "should be a bold heading followed by dash-prefixed sub-points that "
        "capture the specific substance of what was discussed under that theme. "
        "Do not just name the theme — describe what was actually said about it.\n"
        "5. Any follow-up actions identified in the transcript (if none, omit "
        "this section rather than inventing actions)\n"
        "6. A closing that thanks the person and invites them to correct or "
        "add to the record\n"
        "7. Sign off with 'Kind regards,' followed by a blank line (the "
        "consultant will add their own name)\n\n"
        "Tone: formal but warm. Clinical enough to serve as compliance evidence, "
        "human enough to feel respectful and collegial. Avoid filler phrases "
        "like 'I hope this email finds you well' or 'please do not hesitate'. "
        "Get to substance quickly.\n\n"
        "The email body should use plain text with bullet points (• for theme "
        "headings, – for sub-points). Do not use markdown formatting.\n\n"
        "Return a JSON object with:\n"
        "- 'subject': a concise subject line referencing the consultation topic "
        "and date if available\n"
        "- 'body': the full email text\n\n"
        "Return only valid JSON, no markdown wrapping."
    )

    user_content = (
        f"Consultation: {title}\n"
        f"Date: {request.consultation_date or 'not specified'}\n"
        f"People involved: {people_str}\n"
        f"Key themes to cover: {themes_str}\n\n"
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
        return EmailDraftResponse(**parsed)
    except ValidationError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Model output did not match expected schema: {e}",
        )
