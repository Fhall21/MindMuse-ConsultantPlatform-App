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
    ocr_text: str | None = None   # Optional: extracted handwritten note text to include


class ClarificationQuestion(BaseModel):
    question: str               # The question itself
    type: str                   # 'confirm' | 'expand' | 'missing'
    theme_label: str | None     # Which theme it relates to, if any


class ClarificationResponse(BaseModel):
    questions: list[ClarificationQuestion]


# --- Audio transcription ---


class TranscriptionResponse(BaseModel):
    transcript: str
    language: str | None = None
    duration_seconds: float | None = None
    word_count: int


# --- OCR extraction ---


class OcrSegment(BaseModel):
    text: str
    confidence: float               # 0.0–1.0 legibility score for this segment
    segment_type: str               # 'text' | 'heading' | 'list_item' | 'unclear'


class OcrExtractResponse(BaseModel):
    extracted_text: str             # Full text in reading order
    confidence: float               # 0.0–1.0 overall legibility
    segments: list[OcrSegment]


# --- Shorthand expansion ---


class ShorthandExpandRequest(BaseModel):
    raw_text: str                   # Raw OCR/shorthand text to expand
    context: str | None = None      # Brief description of consultation context (helps with domain terms)


class ShorthandChange(BaseModel):
    original: str                   # Original shorthand token/phrase
    expanded: str                   # Expanded form
    reason: str                     # Why this expansion was chosen


class ShorthandExpandResponse(BaseModel):
    expanded_text: str              # Full expanded text
    changes: list[ShorthandChange]  # Log of what was changed and why
