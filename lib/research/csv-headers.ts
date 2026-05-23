const HEADER_SLICE_BYTES = 4096;
const MAX_COLUMNS = 60;

/** Parse a single CSV record (header row) respecting quoted fields. */
export function parseCsvRecord(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/** Read column headers from the first row of a CSV file (first ~4 KB only). */
export async function extractHeaders(file: File): Promise<string[]> {
  const slice = file.slice(0, HEADER_SLICE_BYTES);
  const text = await slice.text();
  const firstLine = text.split(/\r?\n/).find((line) => line.trim().length > 0);
  if (!firstLine) return [];
  return parseCsvRecord(firstLine).slice(0, MAX_COLUMNS);
}
