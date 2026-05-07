import type { ReportRenderPolicy } from "@/lib/report-render-policy";

/**
 * Quote rendering helper. Storage is exact for audit; this function applies
 * anonymous-mode masking AT RENDER TIME using the shared report render policy
 * (sprint 15 contract). It does NOT define a separate masking pipeline.
 *
 * The three rules covered:
 *
 *  - "role_workgroup": replace speaker name + identifying detail with the
 *    quote's denormalised role/work-group context. Speech content stays.
 *  - "redact": replace the entire quote text with a fixed redaction marker.
 *  - "none": pass through verbatim. Used when anonymous mode is off OR when
 *    the consultant has explicitly opted out per quote.
 */

export type QuoteMaskRule = "role_workgroup" | "redact" | "none";

export interface QuoteRenderInput {
  exactText: string;
  speakerLabel: string | null;
  workGroupLabel: string | null;
  anonymousMaskRule: QuoteMaskRule;
  riskFlag: boolean;
}

export interface RenderedQuote {
  /** Quote text after masking (or verbatim when anonymous mode is off). */
  text: string;
  /** Attribution to display alongside the quote text. */
  attribution: string | null;
  /** Whether the quote was masked because of anonymous mode. */
  masked: boolean;
  /** True if this quote was flagged as identifying-content risk. */
  riskFlagged: boolean;
}

const REDACTED_MARKER = "[Redacted for anonymity]";

export function renderQuote(
  input: QuoteRenderInput,
  policy: ReportRenderPolicy
): RenderedQuote {
  if (!policy.anonymousMode || input.anonymousMaskRule === "none") {
    return {
      text: input.exactText,
      attribution: input.speakerLabel ?? input.workGroupLabel ?? null,
      masked: false,
      riskFlagged: input.riskFlag,
    };
  }

  if (input.anonymousMaskRule === "redact") {
    return {
      text: REDACTED_MARKER,
      attribution: input.workGroupLabel ?? null,
      masked: true,
      riskFlagged: input.riskFlag,
    };
  }

  // role_workgroup: keep speech content, mask attribution.
  const maskedText = policy.maskText(input.exactText);
  const attribution = input.workGroupLabel ?? "Anonymous participant";

  return {
    text: maskedText,
    attribution,
    masked: true,
    riskFlagged: input.riskFlag,
  };
}
