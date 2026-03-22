import { jsonError } from "../_helpers";
import { sanitizeAnalyticsErrorMessage } from "@/lib/analytics-error";

export function analyticsRouteError(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : fallbackMessage;

  if (
    message === "Round not found" ||
    message === "Consultation not found" ||
    message === "Cluster not found"
  ) {
    return jsonError(message, 404);
  }

  if (
    message === "Invalid JSON payload" ||
    message.includes("required") ||
    message.includes("must")
  ) {
    return jsonError(message, 422);
  }

  if (message.includes("does not belong")) {
    return jsonError(message, 400);
  }

  console.error("[analytics] request failed", {
    fallbackMessage,
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
  });

  return jsonError(sanitizeAnalyticsErrorMessage(message, fallbackMessage), 500);
}
