from __future__ import annotations

from typing import Any, Dict, List, Optional

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
    rationale: Optional[str] = None               # Optional context for why the decision was made
    weight: float = 1.0                           # 0.0–2.0; user_added defaults higher at call site


class UserPreferences(BaseModel):
    consultation_types: List[str] = []
    focus_areas: List[str] = []
    excluded_topics: List[str] = []


class AIInsightLearning(BaseModel):
    id: str
    user_id: str
    topic_type: str
    learning_type: str
    label: str
    description: str
    supporting_metrics: Dict[str, Any] = {}
    created_at: str
    expires_at: Optional[str] = None
    version: int = 1


# --- Theme extraction ---


class ThemeExtractRequest(BaseModel):
    transcript: str
    learning_signals: List[LearningSignal] = []   # Optional: user-scoped learning history
    ai_learnings: List[AIInsightLearning] = []
    user_preferences: Optional[UserPreferences] = None


class ExtractedTheme(BaseModel):
    label: str           # Short label, e.g. "Workplace stress"
    description: str     # One sentence: why this is a theme
    confidence: float    # 0.0–1.0


class ThemeExtractResponse(BaseModel):
    themes: List[ExtractedTheme]


# --- Stage 7 extraction pipeline ---


class SourceOffset(BaseModel):
    consultation_id: Optional[int] = None
    round_number: Optional[int] = None
    start: int
    end: int


class ExtractedTerm(BaseModel):
    term: str
    original: str
    confidence: float
    extraction_source: str
    pos_tags: List[str] = []
    negation_context: bool = False
    offsets: List[SourceOffset]


class ExtractionMetadataResponse(BaseModel):
    extraction_method: str
    fallback_used: bool
    reduced_recall: bool
    confidence: float
    duration_ms: int
    errors: List[str] = []


class ExtractionRequest(BaseModel):
    consultation_id: Optional[int] = None
    round_number: Optional[int] = None
    transcript: str


class ExtractionResponse(BaseModel):
    terms: List[ExtractedTerm]
    metadata: ExtractionMetadataResponse


# --- Email drafting ---


class EmailDraftRequest(BaseModel):
    transcript: str
    themes: List[str]
    people: List[str]
    consultation_title: Optional[str] = None
    consultation_date: Optional[str] = None  # ISO date, e.g. "2026-03-18"


class EmailDraftResponse(BaseModel):
    subject: str
    body: str


# --- Round workflow drafts and outputs ---


class RoundThemeSeed(BaseModel):
    label: str
    description: Optional[str] = None
    consultation_title: Optional[str] = None
    is_user_added: bool = False
    locked_from_source: bool = False


class RoundThemeGroupDraftRequest(BaseModel):
    round_label: Optional[str] = None
    current_label: Optional[str] = None
    current_description: Optional[str] = None
    structural_change: str
    member_themes: List[RoundThemeSeed]


class RoundThemeGroupDraftResponse(BaseModel):
    draft_label: str
    draft_description: str
    explanation: Optional[str] = None


class RoundOutputTheme(BaseModel):
    label: str
    description: Optional[str] = None
    source_kind: str
    consultation_title: Optional[str] = None
    grouped_under: Optional[str] = None
    is_user_added: bool = False


class ReportTemplateOverride(BaseModel):
    """Optional user-defined template that overrides the default report structure."""
    sections: List[Dict] = []          # [{heading, purpose, prose_guidance, example_excerpt}]
    style_notes: Dict = {}             # {tone, person, formatting_notes}
    prescriptiveness: str = "moderate" # 'flexible' | 'moderate' | 'strict'


class RoundOutputRequest(BaseModel):
    round_label: str
    round_description: Optional[str] = None
    consultations: List[str] = []
    accepted_round_themes: List[RoundOutputTheme] = []
    supporting_consultation_themes: List[RoundOutputTheme] = []
    report_template: Optional[ReportTemplateOverride] = None
    template_suggestions: List[str] = []


class RoundOutputResponse(BaseModel):
    title: str
    content: str


# --- Clarification questions ---


class ClarificationRequest(BaseModel):
    transcript: str
    themes: List[str]             # Accepted themes so far
    context_notes: Optional[str] = None  # Optional: anything the consultant already added
    ocr_text: Optional[str] = None   # Optional: extracted handwritten note text to include


class ClarificationQuestion(BaseModel):
    question: str               # The question itself
    type: str                   # 'confirm' | 'expand' | 'missing'
    theme_label: Optional[str] = None     # Which theme it relates to, if any


class ClarificationResponse(BaseModel):
    questions: List[ClarificationQuestion]


# --- Audio transcription ---


class TranscriptionResponse(BaseModel):
    transcript: str
    language: Optional[str] = None
    duration_seconds: Optional[float] = None
    word_count: int


# --- OCR extraction ---


class OcrSegment(BaseModel):
    text: str
    confidence: float               # 0.0–1.0 legibility score for this segment
    segment_type: str               # 'text' | 'heading' | 'list_item' | 'unclear'


class OcrExtractResponse(BaseModel):
    extracted_text: str             # Full text in reading order
    confidence: float               # 0.0–1.0 overall legibility
    segments: List[OcrSegment]


# --- Theme grouping (AI-suggested round_theme_groups) ---


class ThemeGroupSuggestionInput(BaseModel):
    """A single source theme, for theme group suggestion input."""
    theme_id: str
    label: str
    description: Optional[str] = None
    consultation_title: Optional[str] = None
    is_user_added: bool = False


class ThemeGroupSuggestionRequest(BaseModel):
    round_label: Optional[str] = None
    focus_theme_labels: List[str]       # 2+ themes the user selected as focus
    source_themes: List[ThemeGroupSuggestionInput]


class SuggestedThemeGroup(BaseModel):
    label: str                          # Short group name, e.g. "Workplace Stress"
    theme_ids: List[str]                # IDs of themes to include in this group
    explanation: str                    # Brief rationale (1-2 sentences)


class ThemeGroupSuggestionResponse(BaseModel):
    groups: List[SuggestedThemeGroup]


# --- Consultation grouping (PARKED — future feature) ---


class ConsultationThemeSeed(BaseModel):
    """A single consultation with its accepted themes, for group suggestion input."""
    consultation_id: str
    consultation_title: str
    theme_labels: List[str]           # Accepted theme labels from this consultation
    theme_descriptions: List[str]     # Parallel list of theme descriptions (empty string if none)


class ConsultationGroupSuggestionRequest(BaseModel):
    round_label: Optional[str] = None
    selected_theme_labels: List[str]  # 2+ themes the user wants to cluster around
    consultations: List[ConsultationThemeSeed]


class SuggestedConsultationGroup(BaseModel):
    label: str                        # Short group name, e.g. "Workplace Stress Cluster"
    consultation_ids: List[str]       # IDs of consultations to include
    explanation: str                  # Brief rationale (1-2 sentences)


class ConsultationGroupSuggestionResponse(BaseModel):
    groups: List[SuggestedConsultationGroup]


class ConsultationGroupSummaryConsultation(BaseModel):
    consultation_id: str
    consultation_title: str
    theme_labels: List[str]
    theme_descriptions: List[str]


class ConsultationGroupSummaryRequest(BaseModel):
    round_label: Optional[str] = None
    group_label: str
    consultations: List[ConsultationGroupSummaryConsultation]


class ConsultationGroupSummaryResponse(BaseModel):
    title: str
    content: str


# --- Shorthand expansion ---


class ShorthandExpandRequest(BaseModel):
    raw_text: str                   # Raw OCR/shorthand text to expand
    context: Optional[str] = None      # Brief description of consultation context (helps with domain terms)


class ShorthandChange(BaseModel):
    original: str                   # Original shorthand token/phrase
    expanded: str                   # Expanded form
    reason: str                     # Why this expansion was chosen


class ShorthandExpandResponse(BaseModel):
    expanded_text: str              # Full expanded text
    changes: List[ShorthandChange]  # Log of what was changed and why


# --- Report template analysis ---


class ReportExampleDocument(BaseModel):
    """A single example document (text extracted from uploaded PDF/doc)."""
    file_name: str
    content: str                    # Full text content extracted client-side


class ReportTemplateAnalyseRequest(BaseModel):
    example_documents: List[ReportExampleDocument]  # 1-3 example reports
    prescriptiveness: str = "moderate"              # 'flexible' | 'moderate' | 'strict'


# --- Meeting metadata inference ---


class MeetingMetadataInferRequest(BaseModel):
    transcript: str
    meeting_type_codes: List[str] = []  # e.g. ["1-1", "FC"]; matched against for type suggestion


class MeetingMetadataInferResponse(BaseModel):
    suggested_type_code: Optional[str] = None   # One of meeting_type_codes, or null
    suggested_date: Optional[str] = None        # ISO date YYYY-MM-DD, or null
    suggested_people: List[str] = []         # Participant names (not the interviewer)


class AnalysedTemplateSection(BaseModel):
    heading: str                    # Section heading, e.g. "Executive Summary"
    purpose: str                    # What this section achieves (1 sentence)
    prose_guidance: str             # AI guidance for filling in this section
    example_excerpt: Optional[str] = None  # Short representative excerpt from examples


class AnalysedStyleNotes(BaseModel):
    tone: Optional[str] = None         # e.g. "formal", "conversational", "clinical"
    person: Optional[str] = None       # e.g. "third person", "first person plural"
    formatting_notes: Optional[str] = None  # e.g. "uses bullet lists extensively"


class ReportTemplateAnalyseResponse(BaseModel):
    name: str                       # Suggested template name
    description: str                # 1-2 sentence summary of what this template is for
    sections: List[AnalysedTemplateSection]
    style_notes: AnalysedStyleNotes
