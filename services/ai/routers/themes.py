import json

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from core.config import settings
from core.learning_adapter import build_personalization_prompt
from core.openai_client import get_client
from models.schemas import ThemeExtractRequest, ThemeExtractResponse

router = APIRouter(prefix="/themes", tags=["themes"])


@router.post("/extract", response_model=ThemeExtractResponse)
async def extract_themes(request: ThemeExtractRequest):
    """Extract key themes from a consultation transcript."""
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")

    client = get_client()

    system_prompt = (
        "You are an expert qualitative research analyst. Your task is to extract "
        "specific, substantive findings from a consultation or interview transcript — "
        "not category labels, not domain headings, not topic summaries.\n\n"

        "## WHAT A THEME IS\n\n"
        "A theme is a SPECIFIC finding: a named issue, trigger, barrier, factor, pattern, "
        "or dynamic that was meaningfully discussed. It captures WHAT specifically is "
        "happening, to whom or because of what, and in what context. "
        "It is NOT the name of a domain, topic area, or subject category.\n\n"

        "## LABEL RULES\n\n"
        "The label MUST name the specific issue, finding, or dynamic — not the category "
        "it belongs to.\n\n"
        "FORBIDDEN label patterns (too abstract — NEVER produce these):\n"
        "- '[Domain] concerns' — names a category, not a finding\n"
        "- '[Topic] issues' — says nothing specific about what was discussed\n"
        "- '[Subject] barriers' — names a category, not the specific barrier\n"
        "- '[Process] discussed' — describes that something was talked about, not what it was\n"
        "- '[Area] and its factors' — names a domain, not a finding\n\n"
        "REQUIRED label patterns (specific — ALWAYS produce these):\n"
        "- '[Named cause] preventing [named outcome]' — names the dynamic precisely\n"
        "- '[Named actor or condition] driving [named consequence]' — names cause and effect\n"
        "- '[Named trigger] leading to [named impact]' — names trigger and outcome\n"
        "- '[Named barrier] blocking [named goal] due to [named reason]' — names gap and reason\n"
        "- '[Named change] creating [named problem] for [named person or group]' — names actors\n\n"
        "Apply this pattern regardless of domain. The domain is irrelevant to the rule: "
        "a label that could describe any consultation in any field is too abstract. "
        "A label that names what THIS specific person, situation, or dynamic involves is correct.\n\n"
        "Label length: 5–14 words. Labels MUST be specific enough to stand alone as a finding "
        "without reading the description. Labels MUST NOT use vague nouns like 'concerns', "
        "'issues', 'matters', 'factors', or 'aspects' as the main subject.\n\n"

        "## DESCRIPTION RULES\n\n"
        "The description MUST contain exactly 2–3 sentences covering:\n"
        "1. What specific issue, trigger, or dynamic was raised — name it precisely.\n"
        "2. What contributing factors, causes, named actors, or contextual details were mentioned.\n"
        "3. What was attempted, proposed, agreed, or left unresolved (omit only if truly absent "
        "from the transcript — do not invent).\n\n"
        "The description MUST NOT:\n"
        "- Merely restate the label in different words.\n"
        "- State only that 'this topic was discussed' or 'this theme emerged'.\n"
        "- Summarise at category level (e.g., 'The person raised concerns about [topic]').\n"
        "- Use placeholder language like 'various factors', 'multiple concerns', or 'several issues'.\n\n"
        "The description SHOULD:\n"
        "- Name specific details from the transcript (roles, relationships, timeframes, actions).\n"
        "- Reflect the actual substance of what was said, not a generic gloss of the topic.\n\n"

        "## EXCLUSIONS\n\n"
        "EXCLUDE procedural content with no substantive content: greetings, scheduling, "
        "small talk, administrative housekeeping, status updates that are purely informational.\n\n"
        "Do NOT invent details not present in the transcript. If the transcript is vague on a "
        "topic, reflect that vagueness in a lower confidence score — do not pad the description.\n\n"

        "## CONFIDENCE\n\n"
        "Confidence reflects depth of discussion, not keyword frequency.\n"
        "- 0.9–1.0: explored in depth with specific detail, multiple exchanges, or concrete outcomes\n"
        "- 0.6–0.8: discussed with some substance but not fully elaborated\n"
        "- 0.3–0.5: mentioned briefly, limited elaboration, or heavily implied rather than stated\n"
        "- Below 0.3: do not include — below this threshold the finding is too weak to surface\n\n"

        "## OUTPUT RULES\n\n"
        "Return between 3 and 8 themes. If the transcript is short or ambiguous, return fewer "
        "themes with lower confidence rather than inventing content to reach the minimum.\n\n"
        "Write all output in Australian English (e.g., 'organisation' not 'organization', "
        "'analyse' not 'analyze', 'behaviour' not 'behavior').\n\n"
        "Return a JSON object with a 'themes' array. Each theme MUST have:\n"
        "- 'label': specific finding label (5–14 words, names the exact issue or dynamic)\n"
        "- 'description': 2–3 sentences covering: specific issue, contributing factors, and "
        "what was attempted/proposed/unresolved\n"
        "- 'confidence': float 0.3–1.0 reflecting depth of discussion\n\n"
        "Return ONLY valid JSON. Do NOT wrap in markdown code blocks."
    )

    # Stage 4: inject user-scoped learning context if signals are provided
    personalization = build_personalization_prompt(
        request.learning_signals,
        request.user_preferences,
        request.ai_learnings,
    )
    if personalization:
        system_prompt += personalization

    completion = client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.transcript},
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
        return ThemeExtractResponse(**parsed)
    except ValidationError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Model output did not match expected schema: {e}",
        )
