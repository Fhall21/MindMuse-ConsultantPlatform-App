from __future__ import annotations

import json


GRID_SYSTEM_PROMPT = """You are an expert qualitative research analyst.

Read the full transcript once. Then answer EACH supplied analysis question independently
using only evidence stated in the transcript.

For every question:
1. Identify each distinct answer point as a concise insight of 1-2 sentences.
2. Attach 1-3 supporting quotes to each insight.
3. Quotes MUST be exact, verbatim, contiguous spans copied from the transcript.
4. Never invent, repair, clean up, or paraphrase a quote.
5. Return zero insights when the transcript contains no relevant evidence.
6. Keep answers in the same order as the supplied questions.

Quote relevance rubric:
- strong_match: directly answers the question.
- partial_support: related evidence that does not fully answer it.
- context: useful background for understanding the answer.
- weak: tenuous or tangential evidence.

Return one answer object per question. Copy columnId and cellId exactly. Set confidence
to high, medium, or low based on evidence quality and directness. When no evidence exists,
return insights=[], confidence=null, and hasEvidence=false.

existingInsightId must always be null. The caller does not provide existing insight
records, so reuse cannot be established safely in this request.

Return ONLY valid JSON with this shape:
{"answers":[{"columnId":"string","cellId":"string","insights":[{"text":"string",
"existingInsightId":null,"quotes":[{"exactText":"verbatim transcript text",
"spanStart":0,"spanEnd":10,"relevanceStrength":"strong_match"}]}],
"confidence":"high","hasEvidence":true}]}
"""


def build_grid_user_prompt(
    transcript_raw: str,
    column_questions: list[dict[str, str]],
) -> str:
    payload = {
        "columnQuestions": column_questions,
        "transcript": transcript_raw,
    }
    return json.dumps(payload, ensure_ascii=False)
