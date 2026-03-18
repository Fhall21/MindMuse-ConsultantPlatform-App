from pydantic import BaseModel


# --- Learning signals (Stage 4: user-scoped theme personalization) ---


class LearningSignal(BaseModel):
    """A single user decision about a theme, used to personalize future extraction.

    Sent by the app from persisted learning signal data.
    - 'accept': user confirmed this AI-suggested theme (moderate positive weight)
    - 'reject': user dismissed this theme (negative weight)
    - 'user_added': user created this theme manually (high positive weight)
    """
    label: str                                    # Theme label the decision applies to
    decision_type: str                            # 'accept' | 'reject' | 'user_added'
    rationale: str | None = None                  # Optional context for why the decision was made
    weight: float = 1.0                           # 0.0–2.0; user_added defaults higher at call site


# --- Theme extraction ---


class ThemeExtractRequest(BaseModel):
    transcript: str
    learning_signals: list[LearningSignal] = []   # Optional: user-scoped learning history


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


# --- Round workflow drafts and outputs ---


class RoundThemeSeed(BaseModel):
    label: str
    description: str | None = None
    consultation_title: str | None = None
    is_user_added: bool = False
    locked_from_source: bool = False


class RoundThemeGroupDraftRequest(BaseModel):
    round_label: str | None = None
    current_label: str | None = None
    current_description: str | None = None
    structural_change: str
    member_themes: list[RoundThemeSeed]


class RoundThemeGroupDraftResponse(BaseModel):
    draft_label: str
    draft_description: str
    explanation: str | None = None


class RoundOutputTheme(BaseModel):
    label: str
    description: str | None = None
    source_kind: str
    consultation_title: str | None = None
    grouped_under: str | None = None
    is_user_added: bool = False


class RoundOutputRequest(BaseModel):
    round_label: str
    round_description: str | None = None
    consultations: list[str] = []
    accepted_round_themes: list[RoundOutputTheme] = []
    supporting_consultation_themes: list[RoundOutputTheme] = []


class RoundOutputResponse(BaseModel):
    title: str
    content: str


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
