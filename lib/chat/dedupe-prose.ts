/** Collapse verbatim duplicate prose blocks (stream + persistence race). */
export function collapseDuplicateProse(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return trimmed;
  }

  for (let index = trimmed.indexOf("\n\n"); index !== -1; index = trimmed.indexOf("\n\n", index + 2)) {
    const first = trimmed.slice(0, index);
    const second = trimmed.slice(index).replace(/^\n\n+/, "");
    if (first && first === second) {
      return first;
    }
  }

  if (trimmed.length >= 2 && trimmed.length % 2 === 0) {
    const half = trimmed.length / 2;
    const first = trimmed.slice(0, half);
    const second = trimmed.slice(half);
    if (first === second) {
      return first;
    }
  }

  const paragraphs = trimmed.split(/\n\n+/).map((part) => part.trim()).filter(Boolean);
  if (paragraphs.length >= 2) {
    const deduped: string[] = [];
    for (const paragraph of paragraphs) {
      if (deduped[deduped.length - 1] !== paragraph) {
        deduped.push(paragraph);
      }
    }
    if (deduped.length === 1) {
      return deduped[0] ?? trimmed;
    }
    if (deduped.length !== paragraphs.length) {
      return deduped.join("\n\n");
    }
  }

  return trimmed;
}
