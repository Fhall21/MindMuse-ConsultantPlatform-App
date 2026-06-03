import { isChatCardToolName } from "./card-tools";

export const TURN_CARD_STACK_BLOCKED_MESSAGE =
  "A card is already shown for this turn. Wait for the user to confirm or choose before calling another card tool.";

/** Ensures at most one inline card tool persists per assistant turn. */
export class TurnCardGate {
  private cardShown = false;

  assertCanShowCard(toolName: string): { ok: true } | { ok: false; error: string } {
    if (!isChatCardToolName(toolName)) {
      return { ok: true };
    }
    if (this.cardShown) {
      return { ok: false, error: TURN_CARD_STACK_BLOCKED_MESSAGE };
    }
    return { ok: true };
  }

  markCardShown(toolName: string): void {
    if (isChatCardToolName(toolName)) {
      this.cardShown = true;
    }
  }
}
