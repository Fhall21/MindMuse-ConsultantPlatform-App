import { describe, expect, it } from "vitest";
import {
  CARD_CONFIRMATION_DESTINATION_KEYS,
  getCardSuccessDestinationForConfirmation,
  getCardSuccessDestinationForTool,
  readCardSuccessContextFromOutput,
  resolveCardSuccessLink,
  resolveCardSuccessLinkForConfirmation,
  resolveCardSuccessLinkForTool,
} from "@/lib/chat/card-success-destinations";
import { CARD_CONFIRMATION_ACTIONS } from "@/lib/chat/card-confirmation-copy";

describe("card-success-destinations", () => {
  it("registers every confirmation action with an explicit destination", () => {
    expect(CARD_CONFIRMATION_DESTINATION_KEYS).toEqual(CARD_CONFIRMATION_ACTIONS);
    for (const action of CARD_CONFIRMATION_ACTIONS) {
      const destination = getCardSuccessDestinationForConfirmation(action);
      expect(typeof destination.hasReviewDestination).toBe("boolean");
      if (destination.hasReviewDestination) {
        expect(destination.linkLabel).toBeTruthy();
        expect(destination.buildHref).toBeTypeOf("function");
      }
    }
  });

  it("builds meeting href from meeting_record on intake success output", () => {
    const ctx = readCardSuccessContextFromOutput({
      meeting_record: { id: "m-1", title: "Q2", date: "2026-01-01", projectId: "c-1" },
    });
    expect(ctx.meetingId).toBe("m-1");
    expect(ctx.consultationId).toBe("c-1");

    const link = resolveCardSuccessLinkForTool("intake_text_transcript", ctx);
    expect(link).toEqual({ href: "/meetings/m-1", label: "Open meeting" });
  });

  it("builds themed meeting analysis links", () => {
    const link = resolveCardSuccessLinkForTool("extract_themes", { meetingId: "m-2" });
    expect(link).toEqual({
      href: "/meetings/m-2?tab=analysis#themes",
      label: "View themes",
    });
  });

  it("builds canvas href from consultation id", () => {
    const link = resolveCardSuccessLinkForTool("group_themes", {
      consultationId: "round-1",
    });
    expect(link).toEqual({
      href: "/canvas/round/round-1?tab=canvas",
      label: "View canvas",
    });
  });

  it("returns null when required ids are missing", () => {
    expect(resolveCardSuccessLinkForTool("edit_meeting", {})).toBeNull();
    expect(
      getCardSuccessDestinationForTool("ask_user_choice").hasReviewDestination
    ).toBe(false);
    expect(
      resolveCardSuccessLink(getCardSuccessDestinationForTool("bulk_dismiss_pending"), {})
    ).toBeNull();
  });

  it("maps report export to single report page", () => {
    const link = resolveCardSuccessLinkForTool("export_report", {
      reportId: "r-9",
    });
    expect(link).toEqual({ href: "/reports/r-9", label: "Open report" });
  });

  it("maps literature review to research session", () => {
    const link = resolveCardSuccessLinkForConfirmation("literature_review_started", {
      researchSessionId: "rs-1",
    });
    expect(link).toEqual({
      href: "/research/rs-1",
      label: "Open literature review",
    });
  });
});
