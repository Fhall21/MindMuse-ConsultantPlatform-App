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


# --- Stage 7 extraction pipeline ---


class SourceOffset(BaseModel):
    consultation_id: int | None = None
    round_number: int | None = None
    start: int
    end: int


class ExtractedTerm(BaseModel):
    term: str
    original: str
    confidence: float
    extraction_source: str
    pos_tags: list[str] = []
    negation_context: bool = False
    offsets: list[SourceOffset]


class ExtractionMetadataResponse(BaseModel):
    extraction_method: str
    fallback_used: bool
    reduced_recall: bool
    confidence: float
    duration_ms: int
    errors: list[str] = []


class ExtractionRequest(BaseModel):
    consultation_id: int | None = None
    round_number: int | None = None
    transcript: str


class ExtractionResponse(BaseModel):
    terms: list[ExtractedTerm]
    metadata: ExtractionMetadataResponse


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


class ReportTemplateOverride(BaseModel):
    """Optional user-defined template that overrides the default report structure."""
    sections: list[dict] = []          # [{heading, purpose, prose_guidance, example_excerpt}]
    style_notes: dict = {}             # {tone, person, formatting_notes}
    prescriptiveness: str = "moderate" # 'flexible' | 'moderate' | 'strict'


class RoundOutputRequest(BaseModel):
    round_label: str
    round_description: str | None = None
    consultations: list[str] = []
    accepted_round_themes: list[RoundOutputTheme] = []
    supporting_consultation_themes: list[RoundOutputTheme] = []
    report_template: ReportTemplateOverride | None = None


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


# --- Theme grouping (AI-suggested round_theme_groups) ---


class ThemeGroupSuggestionInput(BaseModel):
    """A single source theme, for theme group suggestion input."""
    theme_id: str
    label: str
    description: str | None = None
    consultation_title: str | None = None
    is_user_added: bool = False


class ThemeGroupSuggestionRequest(BaseModel):
    round_label: str | None = None
    focus_theme_labels: list[str]       # 2+ themes the user selected as focus
    source_themes: list[ThemeGroupSuggestionInput]


class SuggestedThemeGroup(BaseModel):
    label: str                          # Short group name, e.g. "Workplace Stress"
    theme_ids: list[str]                # IDs of themes to include in this group
    explanation: str                    # Brief rationale (1-2 sentences)


class ThemeGroupSuggestionResponse(BaseModel):
    groups: list[SuggestedThemeGroup]


# --- Consultation grouping (PARKED — future feature) ---


class ConsultationThemeSeed(BaseModel):
    """A single consultation with its accepted themes, for group suggestion input."""
    consultation_id: str
    consultation_title: str
    theme_labels: list[str]           # Accepted theme labels from this consultation
    theme_descriptions: list[str]     # Parallel list of theme descriptions (empty string if none)


class ConsultationGroupSuggestionRequest(BaseModel):
    round_label: str | None = None
    selected_theme_labels: list[str]  # 2+ themes the user wants to cluster around
    consultations: list[ConsultationThemeSeed]


class SuggestedConsultationGroup(BaseModel):
    label: str                        # Short group name, e.g. "Workplace Stress Cluster"
    consultation_ids: list[str]       # IDs of consultations to include
    explanation: str                  # Brief rationale (1-2 sentences)


class ConsultationGroupSuggestionResponse(BaseModel):
    groups: list[SuggestedConsultationGroup]


class ConsultationGroupSummaryConsultation(BaseModel):
    consultation_id: str
    consultation_title: str
    theme_labels: list[str]
    theme_descriptions: list[str]


class ConsultationGroupSummaryRequest(BaseModel):
    round_label: str | None = None
    group_label: str
    consultations: list[ConsultationGroupSummaryConsultation]


class ConsultationGroupSummaryResponse(BaseModel):
    title: str
    content: str


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


# --- Report template analysis ---


class ReportExampleDocument(BaseModel):
    """A single example document (text extracted from uploaded PDF/doc)."""
    file_name: str
    content: str                    # Full text content extracted client-side


class ReportTemplateAnalyseRequest(BaseModel):
    example_documents: list[ReportExampleDocument]  # 1-3 example reports
    prescriptiveness: str = "moderate"              # 'flexible' | 'moderate' | 'strict'


class AnalysedTemplateSection(BaseModel):
    heading: str                    # Section heading, e.g. "Executive Summary"
    purpose: str                    # What this section achieves (1 sentence)
    prose_guidance: str             # AI guidance for filling in this section
    example_excerpt: str | None = None  # Short representative excerpt from examples


class AnalysedStyleNotes(BaseModel):
    tone: str | None = None         # e.g. "formal", "conversational", "clinical"
    person: str | None = None       # e.g. "third person", "first person plural"
    formatting_notes: str | None = None  # e.g. "uses bullet lists extensively"


class ReportTemplateAnalyseResponse(BaseModel):
    name: str                       # Suggested template name
    description: str                # 1-2 sentence summary of what this template is for
    sections: list[AnalysedTemplateSection]
    style_notes: AnalysedStyleNotes
