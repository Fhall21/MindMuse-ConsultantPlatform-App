import type { InferSelectModel } from "drizzle-orm";
import type { researchSessions } from "@/db/schema";

type ResearchSession = InferSelectModel<typeof researchSessions>;

interface LiteratureReferenceLike {
  id?: string | null;
  title?: string | null;
  authors?: string | string[] | null;
  year?: string | number | null;
  shortTitle?: string | null;
  url?: string | null;
}

interface AnalysisArtifactLike {
  filename?: string | null;
}

interface ResearchResultLike {
  references?: LiteratureReferenceLike[];
  citation?: string;
  artifacts?: AnalysisArtifactLike[];
}

/**
 * Render a short cite label for a research session, used as the inline reference
 * label on a canvas card or in citation markers. v1 format: "Smith 2024" if we
 * have author + year on a reference, otherwise a truncated session query.
 *
 * The result must be safe to display in tight UI slots (max ~40 chars).
 */
export function researchSessionShortCite(session: ResearchSession): string {
  if (session.sessionType === "analysis") {
    const result = (session.resultData ?? {}) as ResearchResultLike;
    const artifacts = Array.isArray(result.artifacts) ? result.artifacts : [];
    const firstFilename = artifacts[0]?.filename?.trim();
    if (firstFilename) return truncate(firstFilename, 40);
    return truncate(session.query, 40);
  }

  const result = (session.resultData ?? {}) as ResearchResultLike;
  const refs = Array.isArray(result.references) ? result.references : [];
  const firstRef = refs[0];

  if (firstRef) {
    const authorPart = formatAuthorLastName(firstRef.authors);
    const yearPart = firstRef.year ? String(firstRef.year).slice(0, 4) : null;
    if (authorPart && yearPart) return `${authorPart} ${yearPart}`;
    if (authorPart) return authorPart;
    if (firstRef.shortTitle) return truncate(firstRef.shortTitle, 40);
    if (firstRef.title) return truncate(firstRef.title, 40);
  }

  if (result.citation) return truncate(result.citation, 40);
  return truncate(session.query, 40);
}

/**
 * Render a longer cite line for footnotes / References section.
 */
export function researchReferenceFullCite(ref: LiteratureReferenceLike): string {
  const author = formatAuthorList(ref.authors) ?? "Unknown author";
  const year = ref.year ? ` (${String(ref.year).slice(0, 4)})` : "";
  const title = ref.title ?? ref.shortTitle ?? "Untitled source";
  const url = ref.url ? ` ${ref.url}` : "";
  return `${author}${year}. ${title}.${url}`.trim();
}

/**
 * Pull all references off a research session's resultData. Returns [] when
 * resultData lacks a recognisable references array (legacy/incomplete sessions).
 */
export function extractResearchReferences(
  session: ResearchSession
): LiteratureReferenceLike[] {
  const result = (session.resultData ?? {}) as ResearchResultLike;
  return Array.isArray(result.references) ? result.references : [];
}

function formatAnalysisSessionDate(session: ResearchSession): string | null {
  const raw = session.completedAt ?? session.createdAt;
  if (!raw) return null;
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Full cite line for report References — branches on session type. */
export function researchSessionFullCite(session: ResearchSession): string {
  if (session.sessionType === "analysis") {
    const result = (session.resultData ?? {}) as ResearchResultLike;
    const artifacts = Array.isArray(result.artifacts) ? result.artifacts : [];
    const firstFilename = artifacts[0]?.filename?.trim();
    const datePart = formatAnalysisSessionDate(session);
    const queryPart = session.query.trim() || "Untitled analysis";
    const prefix = datePart ? `Data analysis (${datePart})` : "Data analysis";
    if (firstFilename) {
      return `${prefix}: ${queryPart}. Output: ${firstFilename}.`;
    }
    return `${prefix}: ${queryPart}.`;
  }

  const refs = extractResearchReferences(session);
  const firstRef = refs[0];
  if (firstRef) return researchReferenceFullCite(firstRef);
  return `Research session: ${session.query}`;
}

function formatAuthorLastName(authors: string | string[] | null | undefined): string | null {
  if (!authors) return null;
  const first = Array.isArray(authors) ? authors[0] : authors;
  if (!first) return null;
  // Common formats: "Smith, J." or "John Smith" or "Smith J"
  const trimmed = first.trim();
  if (trimmed.includes(",")) {
    return truncate(trimmed.split(",")[0].trim(), 24);
  }
  const tokens = trimmed.split(/\s+/);
  return truncate(tokens[tokens.length - 1], 24);
}

function formatAuthorList(authors: string | string[] | null | undefined): string | null {
  if (!authors) return null;
  if (typeof authors === "string") return authors.trim() || null;
  if (authors.length === 0) return null;
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
  return `${authors[0]} et al.`;
}

function truncate(value: string, max: number): string {
  const v = value.trim();
  if (v.length <= max) return v;
  return `${v.slice(0, max - 1).trimEnd()}…`;
}
