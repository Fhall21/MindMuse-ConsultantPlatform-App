export interface ResumeSuggestion {
  toolName: string;
  label: string;
  prefill: string;
}

const TOOL_LABELS: Record<string, string> = {
  extract_themes: "Resume theme review",
  identify_quotes: "Resume quote review",
  generate_research_questions: "Resume research questions",
  group_themes: "Resume theme grouping",
  prepare_literature_review: "Resume literature review",
};

export function buildResumeSuggestion(
  pendingItem: { toolName: string } | null | undefined
): ResumeSuggestion | null {
  if (!pendingItem) return null;

  const readable = pendingItem.toolName.replace(/_/g, " ");
  return {
    toolName: pendingItem.toolName,
    label: TOOL_LABELS[pendingItem.toolName] ?? `Resume ${readable}`,
    prefill: `Continue ${readable}`,
  };
}
