import json

from fastapi import APIRouter, HTTPException

from core.config import settings
from core.openai_client import get_client
from models.schemas import ThemeExtractRequest, ThemeExtractResponse

router = APIRouter(prefix="/themes", tags=["themes"])


@router.post("/extract", response_model=ThemeExtractResponse)
async def extract_themes(request: ThemeExtractRequest):
    """Extract key themes from a consultation transcript."""
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")

    client = get_client()

    completion = client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert at identifying key themes in psychosocial "
                    "consultation transcripts. Extract the main themes discussed. "
                    "Return a JSON object with a 'themes' array, where each theme "
                    "has a 'label' (string) and 'confidence' (float 0-1). "
                    "Return only valid JSON, no markdown."
                ),
            },
            {"role": "user", "content": request.transcript},
        ],
        response_format={"type": "json_object"},
    )

    content = completion.choices[0].message.content
    if not content:
        raise HTTPException(status_code=502, detail="Empty response from LLM")

    parsed = json.loads(content)
    return ThemeExtractResponse(**parsed)
