import type { Person } from "@/types/db";

export function splitParticipantSuggestions(
  names: string[],
  allPeople: Person[]
): { suggestedExisting: Person[]; suggestedNewNames: string[] } {
  const suggestedExisting: Person[] = [];
  const suggestedNewNames: string[] = [];

  for (const rawName of names) {
    const name = rawName.trim();
    if (!name) {
      continue;
    }

    const existing = allPeople.find(
      (person) => person.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      if (!suggestedExisting.some((person) => person.id === existing.id)) {
        suggestedExisting.push(existing);
      }
      continue;
    }

    if (!suggestedNewNames.some((candidate) => candidate.toLowerCase() === name.toLowerCase())) {
      suggestedNewNames.push(name);
    }
  }

  return { suggestedExisting, suggestedNewNames };
}
