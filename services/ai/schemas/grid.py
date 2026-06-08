from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class GridSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class GridColumnQuestion(GridSchema):
    column_id: str = Field(alias="columnId", min_length=1)
    question: str = Field(min_length=1)
    cell_id: str = Field(alias="cellId", min_length=1)


class GridGenerateRequest(GridSchema):
    meeting_id: str = Field(alias="meetingId", min_length=1)
    transcript_raw: str = Field(alias="transcriptRaw")
    column_questions: list[GridColumnQuestion] = Field(alias="columnQuestions")


class GridQuote(GridSchema):
    exact_text: str = Field(alias="exactText", min_length=1)
    span_start: int = Field(alias="spanStart", ge=0)
    span_end: int = Field(alias="spanEnd", ge=0)
    speaker_label: str | None = Field(default=None, alias="speakerLabel")
    relevance_strength: Literal[
        "strong_match",
        "partial_support",
        "context",
        "weak",
    ] = Field(alias="relevanceStrength")


class GridInsight(GridSchema):
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    existing_insight_id: str | None = Field(
        default=None,
        alias="existingInsightId",
    )
    quotes: list[GridQuote]


class GridAnswer(GridSchema):
    column_id: str = Field(alias="columnId", min_length=1)
    cell_id: str = Field(alias="cellId", min_length=1)
    insights: list[GridInsight]
    confidence: Literal["high", "medium", "low"] | None
    has_evidence: bool = Field(alias="hasEvidence")


class GridGenerateResponse(GridSchema):
    answers: list[GridAnswer]


class GridColumnSuggestionsRequest(GridSchema):
    transcripts: list[str] = Field(max_length=100)


class GridColumnSuggestionsResponse(GridSchema):
    suggestions: list[str] = Field(max_length=5)
