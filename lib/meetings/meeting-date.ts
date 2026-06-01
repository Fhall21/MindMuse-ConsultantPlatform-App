export function toDateInputValue(isoDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(isoDate)) {
    return isoDate.slice(0, 10);
  }
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

export function toIsoDate(dateValue: string): string {
  return `${dateValue}T12:00:00.000Z`;
}
