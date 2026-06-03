import { describe, expect, it } from "vitest";
import { TurnCardGate } from "@/lib/chat/turn-card-gate";

describe("lib/chat/turn-card-gate", () => {
  it("allows the first card tool and blocks a second in the same turn", () => {
    const gate = new TurnCardGate();
    expect(gate.assertCanShowCard("select_meeting_for_action")).toEqual({ ok: true });
    gate.markCardShown("select_meeting_for_action");
    expect(gate.assertCanShowCard("show_quotes").ok).toBe(false);
  });

  it("does not block non-card tools after a card", () => {
    const gate = new TurnCardGate();
    gate.markCardShown("identify_quotes");
    expect(gate.assertCanShowCard("query_consultation_data")).toEqual({ ok: true });
  });
});
