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

interface ResearchResultLike {
  references?: LiteratureReferenceLike[];
  citation?: string;
}

/**
 * Render a short cite label for a research session, used as the inline reference
 * label on a canvas card or in citation markers. v1 format: "Smith 2024" if we
 * have author + year on a reference, otherwise a truncated session query.
 *
 * The result must be safe to display in tight UI slots (max ~40 chars).
 */
export function researchSessionShortCite(session: ResearchSession): string {
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
