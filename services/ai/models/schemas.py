from pydantic import BaseModel


# --- Theme extraction ---


class ThemeExtractRequest(BaseModel):
    transcript: str


class ExtractedTheme(BaseModel):
    label: str           # Short label, e.g. "Workplace stress"
    description: str     # One sentence: why this is a theme
    confidence: float    # 0.0–1.0


class ThemeExtractResponse(BaseModel):
    themes: list[ExtractedTheme]


# --- Email drafting ---


class EmailDraftRequest(BaseModel):
    transcript: str
    themes: list[str]
    people: list[str]
    consultation_title: str | None = None
    consultation_date: str | None = None  # ISO date, e.g. "2026-03-18"


class EmailDraftResponse(BaseModel):
    subject: str
    body: str


# --- Clarification questions ---


class ClarificationRequest(BaseModel):
    transcript: str
    themes: list[str]             # Accepted themes so far
    context_notes: str | None = None  # Optional: anything the consultant already added


class ClarificationQuestion(BaseModel):
    question: str               # The question itself
    type: str                   # 'confirm' | 'expand' | 'missing'
    theme_label: str | None     # Which theme it relates to, if any


class ClarificationResponse(BaseModel):
    questions: list[ClarificationQuestion]
