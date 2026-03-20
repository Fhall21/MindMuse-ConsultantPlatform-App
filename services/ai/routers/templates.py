import json

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from core.config import settings
from core.openai_client import get_client
from models.schemas import (
    ReportTemplateAnalyseRequest,
    ReportTemplateAnalyseResponse,
)

router = APIRouter(prefix="/templates", tags=["templates"])


def _require_client():
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")
    return get_client()


def _parse_json_response(content: str | None):
    if not content:
        raise HTTPException(status_code=502, detail="Empty response from LLM")

    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Model returned invalid JSON: {exc}",
        ) from exc


def _prescriptiveness_instruction(level: str) -> str:
    if level == "strict":
        return (
            "The user wants STRICT prescriptiveness. For each section, provide very specific "
            "prose guidance that closely mirrors the structure, phrasing patterns, and level of "
            "detail found in the examples. Include example excerpts where possible. "
            "The AI generating reports from this template should follow the structure precisely."
        )
    if level == "flexible":
        return (
            "The user wants FLEXIBLE prescriptiveness. For each section, provide high-level "
            "guidance about the purpose and general approach, but allow significant latitude "
            "in how the section is written. Focus on what the section should achieve rather "
            "than how it should read. Omit example excerpts unless they illustrate a critical pattern."
        )
    # moderate (default)
    return (
        "The user wants MODERATE prescriptiveness. For each section, provide clear guidance "
        "about structure and expected content, with some notes on tone and style drawn from "
        "the examples. Include brief example excerpts for key sections to anchor the style, "
        "but leave room for the AI to adapt to the specific consultation data."
    )


@router.post("/analyse-examples", response_model=ReportTemplateAnalyseResponse)
async def analyse_example_reports(request: ReportTemplateAnalyseRequest):
    """
    Analyse 1-3 example report documents and produce a structured report template.

    The template captures:
    - Section structure (headings, purposes, prose guidance)
    - Style notes (tone, person, formatting patterns)
    - Suggested template name and description

    The prescriptiveness level controls how detailed/rigid the guidance is.
    """
    client = _require_client()

    if not request.example_documents:
        raise HTTPException(status_code=422, detail="At least one example document is required")

    if len(request.example_documents) > 3:
        raise HTTPException(status_code=422, detail="Maximum 3 example documents allowed")

    doc_blocks = []
    for i, doc in enumerate(request.example_documents, 1):
        # Truncate very long documents to avoid token limits
        content = doc.content[:15000] if len(doc.content) > 15000 else doc.content
        doc_blocks.append(f"--- Example Document {i}: {doc.file_name} ---\n{content}\n--- End ---")

    documents_text = "\n\n".join(doc_blocks)

    system_prompt = (
        "You are an expert report structure analyst for a psychosocial consultation platform.\n\n"
        "The user has provided example reports that represent how they want their reports to look. "
        "Analyse the structure, sections, tone, and style of these examples and produce a "
        "reusable report template.\n\n"
        f"{_prescriptiveness_instruction(request.prescriptiveness)}\n\n"
        "For each section you identify:\n"
        "- 'heading': The section title as it appears (or a clear standardised version)\n"
        "- 'purpose': One sentence explaining what this section achieves\n"
        "- 'prose_guidance': Instructions for an AI that will write this section. "
        "This should describe what to include, the expected length, any structural patterns "
        "(e.g. bullet lists, numbered items), and tone notes. Write this as a direct instruction "
        "to the AI writer, not as a description of the example.\n"
        "- 'example_excerpt': A short representative excerpt from the example(s) that illustrates "
        "the style. Set to null if not applicable.\n\n"
        "Also extract overall style notes:\n"
        "- 'tone': The overall writing tone (e.g. 'formal and clinical', 'professional but accessible')\n"
        "- 'person': The grammatical person used (e.g. 'third person', 'first person plural')\n"
        "- 'formatting_notes': Any notable formatting patterns (e.g. 'uses bullet lists extensively', "
        "'numbered recommendations', 'bold key terms')\n\n"
        "Return JSON with:\n"
        "- 'name': A suggested template name (e.g. 'Board Report Template', 'Clinical Summary Format')\n"
        "- 'description': 1-2 sentence description of what this template is for\n"
        "- 'sections': Array of section objects\n"
        "- 'style_notes': Object with tone, person, formatting_notes\n\n"
        "Return only valid JSON."
    )

    user_content = (
        f"Prescriptiveness level: {request.prescriptiveness}\n"
        f"Number of example documents: {len(request.example_documents)}\n\n"
        f"{documents_text}"
    )

    completion = client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
        timeout=60.0,
    )

    parsed = _parse_json_response(completion.choices[0].message.content)

    try:
        return ReportTemplateAnalyseResponse(**parsed)
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Model output did not match expected schema: {exc}",
        ) from exc
