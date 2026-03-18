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
