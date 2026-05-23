const TABLE_SEPARATOR_RE = /^\|[-| :]+\|$/;

/** Parse a markdown table row, tolerating a missing trailing pipe. */
export function parseTableRow(row: string): string[] {
  const trimmed = row.trim();
  if (!trimmed.startsWith("|")) return [];

  const hasTrailingPipe = trimmed.endsWith("|");
  return trimmed
    .split("|")
    .slice(1, hasTrailingPipe ? -1 : undefined)
    .map((cell) => cell.trim());
}

export function isTableLine(line: string): boolean {
  return line.trim().startsWith("|");
}

export function isTableSeparatorLine(line: string): boolean {
  return TABLE_SEPARATOR_RE.test(line.trim());
}

/** Extract data rows from table lines, skipping separator rows. */
export function extractTableRows(lines: string[]): string[] {
  return lines
    .map((line) => line.trim())
    .filter((line) => isTableLine(line) && !isTableSeparatorLine(line));
}

export interface NormalizedTableBlock {
  rows: string[];
  /** True when the block has a header row and at least one body row. */
  isValid: boolean;
}

/** Drop blank lines inside a table block and extract renderable rows. */
export function normalizeTableBlock(lines: string[]): NormalizedTableBlock {
  const rows = extractTableRows(lines.filter((line) => line.trim() !== ""));
  return {
    rows,
    isValid: rows.length >= 2,
  };
}
