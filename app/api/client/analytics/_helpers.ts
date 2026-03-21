import { jsonError } from "../_helpers";

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

  return jsonError(message, 500);
}
