import base64
import json

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import ValidationError

from core.config import settings
from core.openai_client import get_client
from models.schemas import OcrExtractResponse

router = APIRouter(prefix="/ocr", tags=["ocr"])

SUPPORTED_IMAGE_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
}

SYSTEM_PROMPT = (
    "You are an expert at reading handwritten psychosocial consultation notes. "
    "Your task is to extract all text from the provided image as faithfully as possible.\n\n"
    "Rules:\n"
    "- Preserve abbreviations and shorthand exactly as written — do not expand them.\n"
    "- Use [?] for any character or word you cannot read with reasonable confidence.\n"
    "- Maintain reading order (top to bottom, left to right unless clearly otherwise).\n"
    "- Distinguish between headings, list items, and body text where evident.\n\n"
    "Return a JSON object with exactly these fields:\n"
    "- 'extracted_text' (string): all text in reading order, newline-separated between segments\n"
    "- 'confidence' (float 0.0–1.0): overall legibility of the image "
    "(1.0 = perfectly clear print, 0.0 = entirely illegible)\n"
    "- 'segments' (array): each segment has:\n"
    "  - 'text' (string): the segment content\n"
    "  - 'confidence' (float 0.0–1.0): legibility of this specific segment\n"
    "  - 'segment_type' (string): one of 'text', 'heading', 'list_item', 'unclear'\n\n"
    "Return only valid JSON, no markdown fences."
)


@router.post("/extract", response_model=OcrExtractResponse)
async def extract_ocr(image_file: UploadFile = File(...)):
    """
    Extract text from a handwritten note image using the vision model.

    Accepts jpeg, png, gif, webp.
    Returns extracted text with per-segment confidence scores.
    Shorthand is preserved as-is — use /shorthand/expand to expand it.
    The caller is responsible for persisting the result to the ocr_jobs table.
    """
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")

    content_type = (image_file.content_type or "").lower()
    if content_type and content_type not in SUPPORTED_IMAGE_TYPES:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unsupported image type: '{content_type}'. "
                "Accepted formats: jpeg, png, gif, webp."
            ),
        )

    image_bytes = await image_file.read()
    if not image_bytes:
        raise HTTPException(status_code=422, detail="Uploaded image is empty")

    effective_type = content_type or "image/jpeg"
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    client = get_client()

    try:
        completion = client.chat.completions.create(
            model=settings.openai_vision_model,
            max_tokens=2048,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": SYSTEM_PROMPT},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{effective_type};base64,{image_b64}",
                                "detail": "high",
                            },
                        },
                    ],
                }
            ],
            response_format={"type": "json_object"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Vision API error: {str(e)}",
        )

    content = completion.choices[0].message.content
    if not content:
        raise HTTPException(
            status_code=502,
            detail="Empty response from vision model",
        )

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Model returned invalid JSON: {e}",
        )

    try:
        return OcrExtractResponse(**parsed)
    except ValidationError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Model output did not match expected schema: {e}",
        )
