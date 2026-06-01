from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ValidationError

from core.config import settings
from core.openai_client import get_client
from models.schemas import EnhanceQuestionRequest, EnhanceQuestionResponse

router = APIRouter(prefix="/research", tags=["research"])


def _format_files_section(files: list) -> str:
    if not files:
        return "No dataset files provided."
    lines: list[str] = []
    for f in files:
        cols = ", ".join(f.columns[:60]) if f.columns else "(no columns detected)"
        lines.append(f"- {f.filename}: columns [{cols}]")
    return "\n".join(lines)


def _format_prior_answers(prior_answers: list) -> str:
    if not prior_answers:
        return ""
    lines = ["User clarifications:"]
    for answer in prior_answers:
        ids = ", ".join(answer.selected_option_ids)
        lines.append(f"- {answer.question_id}: selected [{ids}]")
    return "\n".join(lines)


@router.post("/enhance-question", response_model=EnhanceQuestionResponse)
async def enhance_analysis_question(request: EnhanceQuestionRequest):
    """Refine a data-analysis question or return MCQs when clarification is needed."""
    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=422, detail="query is required")

    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")

    client = get_client()
    has_prior = bool(request.prior_answers)

    system_prompt = (
        "You are a senior HR analytics consultant helping refine data-analysis "
        "questions before they are sent to an automated Python analysis agent.\n\n"
        "Given the user's question, optional industry context, and CSV column "
        "headers, you must either:\n"
        "A) Decide the question is sufficiently clear and return an enhanced_query "
        "that preserves intent while adding precise analytical framing, OR\n"
        "B) Return 2–5 multiple-choice clarifying questions when genuine ambiguity "
        "would materially change the analysis (jurisdiction, time window, grouping "
        "dimension, success metric, hazard framework, comparison baseline, etc.).\n\n"
        "Rules:\n"
        "- Only ask questions when the answer would change methods or scope.\n"
        "- Do NOT ask redundant or cosmetic questions.\n"
        "- Each MCQ has 2–4 options with stable snake_case ids.\n"
        "- Reference column names from the datasets when relevant.\n"
        "- suggested_models: 2–5 statistical or analytical approaches (informational).\n"
        "- background: 1–2 sentences of domain framing for the consultant.\n"
        "- Write in Australian English.\n"
        "- Return only valid JSON matching the schema below.\n\n"
        "If prior_answers are provided, you MUST produce needs_clarification=false "
        "with a final enhanced_query incorporating those answers.\n\n"
        "JSON schema:\n"
        "{\n"
        '  "needs_clarification": boolean,\n'
        '  "enhanced_query": string | null,\n'
        '  "rationale": string | null,\n'
        '  "background": string,\n'
        '  "suggested_models": string[],\n'
        '  "questions": [\n'
        "    {\n"
        '      "id": string,\n'
        '      "question": string,\n'
        '      "rationale": string,\n'
        '      "options": [{"id": string, "label": string}],\n'
        '      "allow_multiple": boolean\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "When needs_clarification is false, enhanced_query is required and "
        "questions must be []. When needs_clarification is true, questions must "
        "have 2–5 items and enhanced_query must be null."
    )

    industry_line = (
        f"Industry context: {request.industry_ctx}"
        if request.industry_ctx
        else "Industry context: (none provided)"
    )
    prior_section = _format_prior_answers(request.prior_answers or [])
    user_content = (
        f"{industry_line}\n\n"
        f"User question:\n{query}\n\n"
        f"Dataset files:\n{_format_files_section(request.files)}\n"
    )
    if prior_section:
        user_content += f"\n{prior_section}\n"

    if has_prior:
        user_content += (
            "\nIncorporate the user's clarifications into a single, precise "
            "enhanced_query. Set needs_clarification to false."
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
        response = EnhanceQuestionResponse(**parsed)
    except ValidationError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Model output did not match expected schema: {e}",
        )

    if response.needs_clarification:
        if not response.questions:
            raise HTTPException(
                status_code=422,
                detail="Model returned needs_clarification=true without questions",
            )
    elif not response.enhanced_query or not response.enhanced_query.strip():
        raise HTTPException(
            status_code=422,
            detail="Model returned needs_clarification=false without enhanced_query",
        )

    return response


class ThemeInput(BaseModel):
    id: str
    label: str
    description: str | None = None


class ResearchGenerateRequest(BaseModel):
    consultation_id: str = Field(min_length=1)
    themes: list[ThemeInput] = Field(default_factory=list)


class ResearchQuestionItem(BaseModel):
    id: str
    question: str
    rationale: str
    linked_theme_id: str | None = None


class ResearchGenerateResponse(BaseModel):
    questions: list[ResearchQuestionItem]


@router.post("/generate", response_model=ResearchGenerateResponse)
async def generate_research_questions(request: ResearchGenerateRequest):
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")

    client = get_client()
    theme_lines = "\n".join(
        f"- {theme.label}: {theme.description or 'no description'}" for theme in request.themes
    ) or "- none"

    system_prompt = (
        "Generate 3-5 focused research questions for a psychosocial consultant. "
        "Return JSON: { \"questions\": [ { \"id\": str, \"question\": str, "
        "\"rationale\": str, \"linked_theme_id\": str|null } ] }"
    )
    user_content = f"Accepted themes:\n{theme_lines}"

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
        return ResearchGenerateResponse(**parsed)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid model output: {exc}") from exc
