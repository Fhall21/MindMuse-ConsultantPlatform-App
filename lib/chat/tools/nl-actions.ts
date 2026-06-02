import { z } from "zod";

export const attachMeetingNoteSchema = z.object({
  meeting_id: z.string().uuid(),
  note: z.string().trim().min(1).max(5000),
});

export const unlinkPersonFromMeetingSchema = z.object({
  meeting_id: z.string().uuid().optional(),
  person_name_hint: z.string().trim().optional(),
});

export const bulkDismissPendingSchema = z.object({
  limit: z.number().int().min(1).max(10).optional(),
});

export interface PersonUnlinkProposal {
  meeting_id: string;
  meeting_title: string;
  person_name_hint?: string;
  people: Array<{ id: string; name: string }>;
}

export interface MeetingNoteProposal {
  meeting_id: string;
  meeting_title: string;
  note: string;
}

export interface BulkDismissProposal {
  items: Array<{ id: string; tool_name: string }>;
}

export function readMeetingNoteProposal(value: unknown): MeetingNoteProposal | null {
  if (!value || typeof value !== "object") return null;
  const proposal = value as Record<string, unknown>;
  if (
    typeof proposal.meeting_id !== "string" ||
    typeof proposal.meeting_title !== "string" ||
    typeof proposal.note !== "string"
  ) {
    return null;
  }
  return {
    meeting_id: proposal.meeting_id,
    meeting_title: proposal.meeting_title,
    note: proposal.note,
  };
}

const PENDING_ITEM_LABELS: Record<string, string> = {
  extract_themes: "Theme review",
  identify_quotes: "Quote review",
  group_themes: "Theme grouping",
  generate_research_questions: "Research questions",
  draft_evidence_email: "Evidence email draft",
  generate_report: "Report draft",
  prepare_literature_review: "Literature review",
  unlink_person_from_meeting: "Person unlink",
  attach_meeting_note: "Meeting note",
};

export function formatPendingItemLabel(toolName: string): string {
  return PENDING_ITEM_LABELS[toolName] ?? "Pending chat action";
}

export function readPersonUnlinkProposal(value: unknown): PersonUnlinkProposal | null {
  if (!value || typeof value !== "object") return null;
  const proposal = value as Record<string, unknown>;
  if (
    typeof proposal.meeting_id !== "string" ||
    typeof proposal.meeting_title !== "string" ||
    !Array.isArray(proposal.people)
  ) {
    return null;
  }
  return {
    meeting_id: proposal.meeting_id,
    meeting_title: proposal.meeting_title,
    person_name_hint:
      typeof proposal.person_name_hint === "string" ? proposal.person_name_hint : undefined,
    people: proposal.people.filter(
      (person): person is { id: string; name: string } =>
        Boolean(person) &&
        typeof person === "object" &&
        typeof (person as { id?: unknown }).id === "string" &&
        typeof (person as { name?: unknown }).name === "string"
    ),
  };
}

export function readBulkDismissProposal(value: unknown): BulkDismissProposal | null {
  if (!value || typeof value !== "object") return null;
  const items = (value as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;
  return {
    items: items.filter(
      (item): item is { id: string; tool_name: string } =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as { id?: unknown }).id === "string" &&
        typeof (item as { tool_name?: unknown }).tool_name === "string"
    ),
  };
}
