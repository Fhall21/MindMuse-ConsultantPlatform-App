/**
 * Build a standardised meeting title from structured fields.
 * Format: "<code> — <Name1>, <Name2> — <Mon YYYY>"
 * Any missing parts are omitted gracefully.
 */
export function buildMeetingTitle(
  typeCode: string | null | undefined,
  firstNames: string[],
  date: Date | null | undefined
): string {
  const parts: string[] = [];

  if (typeCode?.trim()) {
    parts.push(typeCode.trim());
  }

  const names = firstNames
    .map((n) => n.trim().split(/\s+/)[0])
    .filter(Boolean);
  if (names.length > 0) {
    parts.push(names.join(", "));
  }

  if (date) {
    parts.push(
      date.toLocaleDateString("en-GB", { month: "short", year: "numeric" })
    );
  }

  return parts.join(" — ");
}
