export function getConfidenceLabel(confidence: number | undefined): {
  label: string;
  className: string;
} {
  if (confidence === undefined || Number.isNaN(confidence)) {
    return { label: "Pending review", className: "text-muted-foreground" };
  }

  if (confidence >= 0.7) {
    return {
      label: "High confidence",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    };
  }

  if (confidence >= 0.4) {
    return {
      label: "Medium confidence",
      className:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
    };
  }

  return {
    label: "Low confidence",
    className:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
  };
}
