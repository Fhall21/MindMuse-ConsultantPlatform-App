from pydantic import BaseModel


# --- Theme extraction ---


class ThemeExtractRequest(BaseModel):
    transcript: str


class ExtractedTheme(BaseModel):
    label: str
    confidence: float


class ThemeExtractResponse(BaseModel):
    themes: list[ExtractedTheme]


# --- Email drafting ---


class EmailDraftRequest(BaseModel):
    transcript: str
    themes: list[str]
    people: list[str]
    consultation_title: str | None = None


class EmailDraftResponse(BaseModel):
    subject: str
    body: str
