import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";

/** UI model — normalized from API string[] in useColumnSuggestions. */
export interface ColumnSuggestion {
  question: string;
  rationale: string | null;
}

/** Wire format from GET .../grid/column-suggestions (see gridColumnSuggestionsResponseSchema). */
export interface ColumnSuggestionsResponse {
  suggestions: string[];
}

export function normalizeColumnSuggestions(raw: unknown): ColumnSuggestion[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const normalized: ColumnSuggestion[] = [];

  for (const item of raw) {
    let question: string | null = null;
    let rationale: string | null = null;

    if (typeof item === "string") {
      question = item;
    } else if (item && typeof item === "object" && "question" in item) {
      const candidate = item as { question?: unknown; rationale?: unknown };
      question =
        typeof candidate.question === "string" ? candidate.question : null;
      rationale =
        typeof candidate.rationale === "string" ? candidate.rationale : null;
    }

    if (!question) continue;

    const trimmed = question.trim();
    if (!trimmed || seen.has(trimmed)) continue;

    seen.add(trimmed);
    normalized.push({ question: trimmed, rationale });
  }

  return normalized;
}

/** @deprecated Use normalizeColumnSuggestions — kept for existing tests. */
export function dedupeColumnSuggestions(
  suggestions: ColumnSuggestion[]
): ColumnSuggestion[] {
  return normalizeColumnSuggestions(suggestions);
}

export function useColumnSuggestions(roundId: string, enabled = false) {
  const query = useQuery<ColumnSuggestionsResponse>({
    queryKey: ["column-suggestions", roundId],
    queryFn: () =>
      fetchJson<ColumnSuggestionsResponse>(
        `/api/client/consultations/${roundId}/grid/column-suggestions`
      ),
    enabled: Boolean(roundId) && enabled,
    staleTime: 5 * 60 * 1000,
  });

  const suggestions = useMemo(
    () => normalizeColumnSuggestions(query.data?.suggestions),
    [query.data?.suggestions]
  );

  const isLoadingSuggestions =
    query.isPending || (query.isFetching && query.data === undefined);

  return {
    ...query,
    suggestions,
    isLoadingSuggestions,
  };
}
