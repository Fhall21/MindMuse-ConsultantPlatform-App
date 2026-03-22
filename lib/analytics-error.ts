const TECHNICAL_ANALYTICS_ERROR_PATTERN =
  /(psycopg2|sqlalchemy|traceback|\[sql:|\[parameters:|sqlalche\.me|on conflict|insert into|update\s+\w+|delete from|select\s+.+from|null value in column|violates .*constraint|there is no unique or exclusion constraint)/i;

export const DEFAULT_ANALYTICS_ERROR_MESSAGE =
  "Analytics failed. Retry the run. If it keeps failing, check server logs.";

export function sanitizeAnalyticsErrorMessage(
  message: string | null | undefined,
  fallback = DEFAULT_ANALYTICS_ERROR_MESSAGE
) {
  if (!message) {
    return fallback;
  }

  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return fallback;
  }

  if (normalized.length > 220 || TECHNICAL_ANALYTICS_ERROR_PATTERN.test(normalized)) {
    return fallback;
  }

  return normalized;
}