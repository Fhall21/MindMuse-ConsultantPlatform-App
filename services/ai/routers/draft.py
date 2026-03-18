from fastapi import APIRouter, HTTPException

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

    completion = client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a professional consultation follow-up email writer. "
                    "Write a clear, professional evidence email that confirms a "
                    "consultation took place, summarises the key themes discussed, "
                    "and lists any follow-up actions. The email should serve as "
                    "auditable evidence that the consultation occurred. "
                    "Return a JSON object with 'subject' (string) and 'body' (string). "
                    "Return only valid JSON, no markdown."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Consultation: {title}\n"
                    f"People involved: {people_str}\n"
                    f"Key themes: {themes_str}\n\n"
                    f"Transcript:\n{request.transcript}"
                ),
            },
        ],
        response_format={"type": "json_object"},
    )

    content = completion.choices[0].message.content
    if not content:
        raise HTTPException(status_code=502, detail="Empty response from LLM")

    import json
    parsed = json.loads(content)
    return EmailDraftResponse(**parsed)
