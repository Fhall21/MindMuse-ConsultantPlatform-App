import json

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from core.config import settings
from core.openai_client import get_client
from models.schemas import (
    ConsultationGroupSuggestionRequest,
    ConsultationGroupSuggestionResponse,
    ConsultationGroupSummaryRequest,
    ConsultationGroupSummaryResponse,
    RoundOutputRequest,
    RoundOutputResponse,
    RoundThemeGroupDraftRequest,
    RoundThemeGroupDraftResponse,
    ThemeGroupSuggestionRequest,
    ThemeGroupSuggestionResponse,
)

router = APIRouter(prefix="/rounds", tags=["rounds"])


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


@router.post("/refine-group-draft", response_model=RoundThemeGroupDraftResponse)
async def refine_group_draft(request: RoundThemeGroupDraftRequest):
    client = _require_client()

    member_lines = "\n".join(
        [
            (
                f"- {theme.label}"
                f" | consultation={theme.consultation_title or 'unknown'}"
                f" | description={theme.description or 'none'}"
                f" | user_added={'yes' if theme.is_user_added else 'no'}"
                f" | locked={'yes' if theme.locked_from_source else 'no'}"
            )
            for theme in request.member_themes
        ]
    )

    system_prompt = (
        "You are helping a consultant maintain auditable round-level theme groups.\n\n"
        "A round theme group clusters one or more consultation themes into a clearer round-level theme. "
        "Structural edits have already happened in the UI. Your job is only to suggest a draft label and "
        "draft description for the group after that edit.\n\n"
        "Requirements:\n"
        "- Keep the label concise: 2-6 words.\n"
        "- Keep the description to 1-2 sentences.\n"
        "- Ground the suggestion in the member themes provided.\n"
        "- Do not invent new evidence or management decisions.\n"
        "- If the member themes are narrow, keep the group specific.\n"
        "- If the member themes are diverse, name the shared concern without flattening meaningful nuance.\n"
        "- Mention locked or user-added themes only if it materially explains the grouping.\n\n"
        "Return JSON with:\n"
        "- draft_label\n"
        "- draft_description\n"
        "- explanation\n\n"
        "Return only valid JSON."
    )

    user_content = (
        f"Round: {request.round_label or 'Untitled round'}\n"
        f"Current label: {request.current_label or 'none'}\n"
        f"Current description: {request.current_description or 'none'}\n"
        f"Structural change: {request.structural_change}\n\n"
        f"Member themes:\n{member_lines}"
    )

    completion = client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
    )

    parsed = _parse_json_response(completion.choices[0].message.content)

    try:
        return RoundThemeGroupDraftResponse(**parsed)
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Model output did not match expected schema: {exc}",
        ) from exc


def _round_output_prompt(artifact_type: str):
    if artifact_type == "summary":
        return (
            "You are writing a round-level consultation summary for internal use.\n\n"
            "Write a concise synthesis that:\n"
            "- starts with a one-line overview\n"
            "- groups the round-level themes into a short structured summary\n"
            "- cites supporting consultation-level nuance without reproducing raw transcripts\n"
            "- avoids claims not grounded in the provided themes\n\n"
            "Return JSON with 'title' and 'content'. The content should be plain text."
        )

    if artifact_type == "report":
        return (
            "You are drafting a round-level consultation report for internal evidence and reporting.\n\n"
            "Write a structured report with:\n"
            "- Executive summary\n"
            "- Accepted round themes\n"
            "- Supporting consultation-level evidence themes\n"
            "- Key follow-up or monitoring considerations if they are implied by the themes\n\n"
            "Do not invent recommendations that are not grounded in the inputs.\n"
            "Return JSON with 'title' and 'content'. The content should be plain text."
        )

    return (
        "You are drafting a round-level evidence email for internal coordination.\n\n"
        "Write a concise but substantive email-style artifact that:\n"
        "- references the round name\n"
        "- summarizes the accepted round themes first\n"
        "- briefly notes supporting consultation-level evidence\n"
        "- keeps a professional, auditable tone\n\n"
        "Return JSON with 'title' and 'content'. The 'title' should be the email subject."
    )


def _round_output_user_content(request: RoundOutputRequest):
    round_theme_lines = "\n".join(
        [
            (
                f"- {theme.label}"
                f" | description={theme.description or 'none'}"
                f" | grouped_under={theme.grouped_under or 'standalone'}"
                f" | source={theme.source_kind}"
            )
            for theme in request.accepted_round_themes
        ]
    ) or "- none"

    supporting_lines = "\n".join(
        [
            (
                f"- {theme.label}"
                f" | consultation={theme.consultation_title or 'unknown'}"
                f" | description={theme.description or 'none'}"
                f" | grouped_under={theme.grouped_under or 'standalone'}"
            )
            for theme in request.supporting_consultation_themes
        ]
    ) or "- none"

    return (
        f"Round: {request.round_label}\n"
        f"Round description: {request.round_description or 'none'}\n"
        f"Linked consultations: {', '.join(request.consultations) or 'none'}\n\n"
        f"Accepted round themes:\n{round_theme_lines}\n\n"
        f"Supporting consultation themes:\n{supporting_lines}"
    )


async def _generate_round_output(artifact_type: str, request: RoundOutputRequest):
    client = _require_client()

    completion = client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": _round_output_prompt(artifact_type)},
            {"role": "user", "content": _round_output_user_content(request)},
        ],
        response_format={"type": "json_object"},
    )

    parsed = _parse_json_response(completion.choices[0].message.content)

    try:
        return RoundOutputResponse(**parsed)
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Model output did not match expected schema: {exc}",
        ) from exc


@router.post("/generate-summary", response_model=RoundOutputResponse)
async def generate_round_summary(request: RoundOutputRequest):
    return await _generate_round_output("summary", request)


@router.post("/generate-report", response_model=RoundOutputResponse)
async def generate_round_report(request: RoundOutputRequest):
    return await _generate_round_output("report", request)


@router.post("/generate-email", response_model=RoundOutputResponse)
async def generate_round_email(request: RoundOutputRequest):
    return await _generate_round_output("email", request)


@router.post("/suggest-theme-groups", response_model=ThemeGroupSuggestionResponse)
async def suggest_theme_groups(request: ThemeGroupSuggestionRequest):
    """
    Analyse source themes and suggest how they should be clustered into round_theme_groups.
    The user picks 2+ focus themes; AI identifies natural clusters across all source themes.

    AI flow:
      focus_theme_labels (user-picked) + source_themes (id, label, description, consultation)
        → GPT-4o-mini (JSON mode, 30s timeout)
        → { groups: [{ label, theme_ids, explanation }] }
    """
    client = _require_client()

    focus = ", ".join(request.focus_theme_labels) or "none"

    theme_lines = "\n".join(
        [
            (
                f"- id={t.theme_id} | label={t.label}"
                f" | description={t.description or 'none'}"
                f" | consultation={t.consultation_title or 'unknown'}"
                f" | user_added={'yes' if t.is_user_added else 'no'}"
            )
            for t in request.source_themes
        ]
    ) or "- none"

    system_prompt = (
        "You are helping a psychosocial consultant group themes from multiple consultations "
        "into meaningful round-level theme groups.\n\n"
        "The consultant has selected focus themes. Your job is to identify natural clusters "
        "across all source themes, anchored around the focus themes.\n\n"
        "Rules:\n"
        "- Each theme may appear in at most one group.\n"
        "- A group must have at least 2 themes.\n"
        "- Group labels should be concise (2-5 words) and evidence-based.\n"
        "- Explanations should be 1-2 sentences grounded in the theme content.\n"
        "- Themes that do not fit any cluster should be omitted from the output.\n"
        "- Do not invent themes or evidence not present in the input.\n\n"
        "Return JSON with: { \"groups\": [ { \"label\": str, \"theme_ids\": [str, ...], "
        "\"explanation\": str }, ... ] }\n"
        "Return only valid JSON."
    )

    user_content = (
        f"Round: {request.round_label or 'Untitled round'}\n"
        f"Focus themes selected by consultant: {focus}\n\n"
        f"All source themes in this round:\n{theme_lines}"
    )

    completion = client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
        timeout=30.0,
    )

    parsed = _parse_json_response(completion.choices[0].message.content)

    try:
        return ThemeGroupSuggestionResponse(**parsed)
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Model output did not match expected schema: {exc}",
        ) from exc


@router.post("/suggest-consultation-groups", response_model=ConsultationGroupSuggestionResponse)
async def suggest_consultation_groups(request: ConsultationGroupSuggestionRequest):
    """
    Analyse how the user's selected themes cluster across consultations and suggest
    natural consultation groups. Each suggestion includes a label and explanation.

    AI flow:
      selected_theme_labels (user-picked) + consultations (id, title, themes)
        → GPT-4o-mini (JSON mode, 30s timeout)
        → { groups: [{ label, consultation_ids, explanation }] }
    """
    client = _require_client()

    selected = ", ".join(request.selected_theme_labels) or "none"

    consultation_lines = "\n".join(
        [
            (
                f"- id={c.consultation_id} | title={c.consultation_title}"
                f" | themes: {'; '.join(c.theme_labels) or 'none'}"
            )
            for c in request.consultations
        ]
    ) or "- none"

    system_prompt = (
        "You are helping a psychosocial consultant group a set of consultations into "
        "meaningful clusters based on shared themes.\n\n"
        "The consultant has selected a set of focus themes. Your job is to analyse which "
        "consultations share those themes (or closely related themes) and suggest a small "
        "number of natural groups.\n\n"
        "Rules:\n"
        "- Each consultation may appear in at most one group.\n"
        "- A group must have at least 2 consultations.\n"
        "- Group labels should be concise (2-6 words) and evidence-based.\n"
        "- Explanations should be 1-2 sentences, grounded in the theme overlap.\n"
        "- Consultations that do not fit any group should be omitted from the output.\n"
        "- Do not invent themes or evidence not present in the input.\n\n"
        "Return JSON with: { \"groups\": [ { \"label\": str, \"consultation_ids\": [str, ...], "
        "\"explanation\": str }, ... ] }\n"
        "Return only valid JSON."
    )

    user_content = (
        f"Round: {request.round_label or 'Untitled round'}\n"
        f"Focus themes selected by consultant: {selected}\n\n"
        f"Consultations in this round:\n{consultation_lines}"
    )

    completion = client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
        timeout=30.0,
    )

    parsed = _parse_json_response(completion.choices[0].message.content)

    try:
        return ConsultationGroupSuggestionResponse(**parsed)
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Model output did not match expected schema: {exc}",
        ) from exc


@router.post("/generate-group-summary", response_model=ConsultationGroupSummaryResponse)
async def generate_group_summary(request: ConsultationGroupSummaryRequest):
    """
    Generate a short evidence summary for a consultation group.
    Used to produce a group-level artifact in the round outputs section.
    """
    client = _require_client()

    consultation_lines = "\n".join(
        [
            (
                f"- {c.consultation_title}:"
                f" {'; '.join(c.theme_labels) or 'no themes'}"
            )
            for c in request.consultations
        ]
    ) or "- none"

    system_prompt = (
        "You are writing a concise evidence summary for a group of consultations within a "
        "psychosocial consultation round.\n\n"
        "The group is a named cluster of consultations that share common themes. "
        "Your summary should:\n"
        "- Open with one sentence naming the shared concern across the group.\n"
        "- Note any relevant theme patterns or escalation considerations.\n"
        "- Stay grounded in the provided themes — do not invent evidence.\n"
        "- Be 2-4 sentences total.\n\n"
        "Return JSON with 'title' (the group label as the title) and 'content' (the summary text).\n"
        "Return only valid JSON."
    )

    user_content = (
        f"Round: {request.round_label or 'Untitled round'}\n"
        f"Group: {request.group_label}\n\n"
        f"Consultations in this group:\n{consultation_lines}"
    )

    completion = client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
        timeout=30.0,
    )

    parsed = _parse_json_response(completion.choices[0].message.content)

    try:
        return ConsultationGroupSummaryResponse(**parsed)
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Model output did not match expected schema: {exc}",
        ) from exc
