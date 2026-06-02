import type { CardConfirmationAction } from "@/lib/chat/card-confirmation-copy";

export async function notifyCardConfirmation(
  sessionId: string | null | undefined,
  action: CardConfirmationAction,
  toolResultId?: string | null
): Promise<void> {
  if (!sessionId) {
    return;
  }

  const response = await fetch("/api/chat/card-confirmation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, action, toolResultId }),
  });

  if (!response.ok) {
    console.error("[chat] failed to append card confirmation", await response.text());
  }
}
