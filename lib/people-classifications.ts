export function isNonEmptyString(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

export function getDistinctCaseInsensitiveValues(
  values: Array<string | null | undefined>
) {
  const dedupedValues = new Map<string, string>();

  for (const value of values) {
    if (!isNonEmptyString(value)) {
      continue;
    }

    const trimmedValue = value.trim();
    const normalizedValue = trimmedValue.toLocaleLowerCase();

    if (!dedupedValues.has(normalizedValue)) {
      dedupedValues.set(normalizedValue, trimmedValue);
    }
  }

  return [...dedupedValues.values()].sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" })
  );
}

export function filterCaseInsensitiveValues(options: string[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return options;
  }

  return options.filter((option) =>
    option.toLocaleLowerCase().includes(normalizedQuery)
  );
}

export function normalizeClassificationValue(
  value: string | undefined,
  options: string[]
) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return undefined;
  }

  const normalizedValue = trimmedValue.toLocaleLowerCase();
  const existingOption = options.find(
    (option) => option.toLocaleLowerCase() === normalizedValue
  );

  return existingOption ?? trimmedValue;
}
