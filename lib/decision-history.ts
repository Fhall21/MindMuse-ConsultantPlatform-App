type DecisionRecord = {
  target_type: string;
  target_id: string;
  metadata?: Record<string, unknown> | null;
};

function metadataLabel(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) {
    return null;
  }

  const editedLabel = typeof metadata.edited_label === "string" ? metadata.edited_label : null;
  if (editedLabel && editedLabel.trim()) {
    return editedLabel.trim();
  }

  const originalLabel =
    typeof metadata.original_label === "string" ? metadata.original_label : null;
  if (originalLabel && originalLabel.trim()) {
    return originalLabel.trim();
  }

  return null;
}

export function resolveDecisionTargetLabel(
  decision: DecisionRecord,
  groupLabelById: Map<string, string>,
  themeLabelById: Map<string, string>
) {
  if (decision.target_type === "theme_group") {
    return groupLabelById.get(decision.target_id) ?? metadataLabel(decision.metadata) ?? null;
  }

  if (decision.target_type === "source_theme") {
    return themeLabelById.get(decision.target_id) ?? null;
  }

  return metadataLabel(decision.metadata) ?? null;
}