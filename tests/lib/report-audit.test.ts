import { describe, expect, it } from "vitest";
import {
  clusterAuditEvents,
  filterMajorEvents,
} from "@/lib/report-audit";
import type { AuditSummaryEvent } from "@/lib/actions/reports";

// Helper: build a minimal AuditSummaryEvent
function evt(
  action: string,
  createdAtOffset: number = 0,
  baseMs: number = 1_700_000_000_000
): AuditSummaryEvent {
  return {
    action,
    createdAt: new Date(baseMs + createdAtOffset).toISOString(),
    entityType: null,
  };
}

/** 90 seconds in milliseconds */
const NINETY_SECONDS = 90 * 1000;
/** 3 minutes in milliseconds — outside the 2-minute merge window */
const THREE_MINUTES = 3 * 60 * 1000;

describe("lib/report-audit - clusterAuditEvents", () => {
  // ─── Core fix: opposite actions must never merge ─────────────────────────

  it("theme.accepted and theme.rejected within 2 minutes → two separate clusters", () => {
    const events = [
      evt("theme.accepted", 0),
      evt("theme.rejected", NINETY_SECONDS),
    ];
    const clusters = clusterAuditEvents(events);

    expect(clusters).toHaveLength(2);
    // Clusters are newest-first
    expect(clusters[0].action).toBe("theme.rejected");
    expect(clusters[1].action).toBe("theme.accepted");
    expect(clusters[0].count).toBe(1);
    expect(clusters[1].count).toBe(1);
  });

  it("theme.rejected and theme.accepted in reverse order → still two clusters", () => {
    const events = [
      evt("theme.rejected", 0),
      evt("theme.accepted", NINETY_SECONDS),
    ];
    const clusters = clusterAuditEvents(events);

    expect(clusters).toHaveLength(2);
    expect(clusters.some((c) => c.action === "theme.accepted")).toBe(true);
    expect(clusters.some((c) => c.action === "theme.rejected")).toBe(true);
  });

  // ─── Same-action merging still works ────────────────────────────────────

  it("theme.accepted × 4 within 90s → one cluster with count=4", () => {
    const events = [
      evt("theme.accepted", 0),
      evt("theme.accepted", 20_000),
      evt("theme.accepted", 45_000),
      evt("theme.accepted", NINETY_SECONDS - 1),
    ];
    const clusters = clusterAuditEvents(events);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].action).toBe("theme.accepted");
    expect(clusters[0].count).toBe(4);
  });

  it("round.target_accepted × 3 within 90s → one cluster with count=3", () => {
    const events = [
      evt("round.target_accepted", 0),
      evt("round.target_accepted", 30_000),
      evt("round.target_accepted", 80_000),
    ];
    const clusters = clusterAuditEvents(events);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].action).toBe("round.target_accepted");
    expect(clusters[0].count).toBe(3);
  });

  // ─── Same action outside 2-minute window → separate clusters ────────────

  it("theme.accepted events > 2 minutes apart → two separate clusters", () => {
    const events = [
      evt("theme.accepted", 0),
      evt("theme.accepted", THREE_MINUTES),
    ];
    const clusters = clusterAuditEvents(events);

    expect(clusters).toHaveLength(2);
    expect(clusters.every((c) => c.action === "theme.accepted")).toBe(true);
    expect(clusters.every((c) => c.count === 1)).toBe(true);
  });

  // ─── Mixed events ────────────────────────────────────────────────────────

  it("interleaved different actions within 2 min → each action is its own cluster", () => {
    const events = [
      evt("theme.accepted", 0),
      evt("theme.rejected", 10_000),
      evt("theme.accepted", 20_000),
    ];
    const clusters = clusterAuditEvents(events);

    // Each event has a different action from the previous, so no merging
    expect(clusters).toHaveLength(3);
  });

  it("returns newest-first ordering", () => {
    const events = [
      evt("consultation.created", 0),
      evt("theme.accepted", THREE_MINUTES),
    ];
    const clusters = clusterAuditEvents(events);

    expect(clusters[0].action).toBe("theme.accepted");
    expect(clusters[1].action).toBe("consultation.created");
  });

  it("returns empty array for empty input", () => {
    expect(clusterAuditEvents([])).toEqual([]);
  });

  // ─── Single event ────────────────────────────────────────────────────────

  it("single event → one cluster with count=1", () => {
    const clusters = clusterAuditEvents([evt("evidence_email.sent", 0)]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].count).toBe(1);
    expect(clusters[0].action).toBe("evidence_email.sent");
  });
});

describe("lib/report-audit - filterMajorEvents", () => {
  it("removes events not in the MAJOR_EVENT_ACTIONS set", () => {
    const events: AuditSummaryEvent[] = [
      evt("theme.accepted", 0),
      evt("theme.label_changed", 1000),   // micro-action — not in set
      evt("consultation.created", 2000),
      evt("group.renamed", 3000),          // micro-action — not in set
      evt("evidence_email.sent", 4000),
    ];

    const filtered = filterMajorEvents(events);

    expect(filtered.map((e) => e.action)).toEqual([
      "theme.accepted",
      "consultation.created",
      "evidence_email.sent",
    ]);
  });

  it("returns empty array when all events are micro-actions", () => {
    const events = [
      evt("theme.label_changed", 0),
      evt("group.renamed", 1000),
    ];
    expect(filterMajorEvents(events)).toEqual([]);
  });

  it("returns all events when all are major actions", () => {
    const events = [
      evt("theme.accepted", 0),
      evt("theme.rejected", 1000),
      evt("transcript.parsed", 2000),
    ];
    expect(filterMajorEvents(events)).toHaveLength(3);
  });
});
