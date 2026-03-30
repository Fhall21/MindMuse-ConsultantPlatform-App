const MAX_LENGTH = 500;

const INJECTION_PATTERNS = [
  /system\s*:/gi,
  /instructions?\s*:/gi,
  /ignore\s+(all\s+)?previous/gi,
  /disregard\s+(all\s+)?previous/gi,
  /forget\s+(all\s+)?previous/gi,
  /you\s+are\s+now/gi,
  /new\s+instructions?\s*:/gi,
  /override\s*:/gi,
  /<\|endoftext\|>/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<<SYS>>/gi,
  /<<\/SYS>>/gi,
];

/**
 * Strip prompt-injection patterns and enforce length limit on freetext section notes.
 */
export function sanitizeSectionNote(text: string): string {
  let result = text.trim();

  for (const pattern of INJECTION_PATTERNS) {
    result = result.replace(pattern, "");
  }

  // Collapse multiple spaces left by removals
  result = result.replace(/\s{2,}/g, " ").trim();

  if (result.length > MAX_LENGTH) {
    result = result.slice(0, MAX_LENGTH);
  }

  return result;
}

/**
 * Wrap a sanitized note in XML tags for safe injection into the LLM prompt.
 */
export function containSectionNote(text: string): string {
  const sanitized = sanitizeSectionNote(text);
  if (!sanitized) return "";
  return `<section_note>${sanitized}</section_note>`;
}
