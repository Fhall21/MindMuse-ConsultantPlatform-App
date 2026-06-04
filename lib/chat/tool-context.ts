import type { TurnCardGate } from "./turn-card-gate";

export interface ChatToolRuntimeContext {
  userId: string;
  sessionId: string;
  turnCardGate?: TurnCardGate;
  latestUserMessage?: string | null;
  lastMeetingId?: string | null;
}
