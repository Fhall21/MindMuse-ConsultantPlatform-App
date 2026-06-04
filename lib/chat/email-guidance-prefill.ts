export function extractEvidenceEmailRevisionRequest(request: string | null | undefined): string {
  const trimmed = request?.trim() ?? "";
  if (!trimmed) {
    return "";
  }

  if (
    /\b(make|revise|revision|edit|change|shorter|longer|warmer|friendlier|formal|professional|concise|brief|tighten|trim|rewrite|reword|adjust)\b/i.test(
      trimmed
    )
  ) {
    return trimmed;
  }

  return "";
}

export function buildEvidenceEmailGuidancePrefill(request: string): string {
  const trimmed = request.trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed) {
    return "";
  }

  if (/\b(short|shorter|concise|brief|briefer|tighten|trim)\b/.test(lower)) {
    return "Make the evidence email shorter and more concise.";
  }

  if (/\b(warm|warmer|friendly|friendlier|human)\b/.test(lower)) {
    return "Make the evidence email warmer while keeping it professional.";
  }

  if (/\b(formal|clinical|professional)\b/.test(lower)) {
    return "Make the evidence email more formal and evidence-focused.";
  }

  if (/\b(action|actions|next steps|follow-up|follow up)\b/.test(lower)) {
    return "Lead with clear actions and next steps.";
  }

  return trimmed;
}
