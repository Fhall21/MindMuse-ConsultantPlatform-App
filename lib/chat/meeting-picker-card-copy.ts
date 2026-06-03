import type { MeetingPendingAction } from "./meeting-pending-action";

export function meetingPickerSuccessDescription(
  pendingAction: MeetingPendingAction | null
): string {
  switch (pendingAction) {
    case "identify_quotes":
      return "Extracting key quotes — review them in the card below.";
    case "show_quotes":
      return "Opening the quote review panel below.";
    case "extract_themes":
      return "Theme extraction is ready for review in the card below.";
    case "draft_evidence_email":
      return "Evidence email draft is ready for review below.";
    case "create_insight":
      return "Add your insight in the card below.";
    case "link_person_to_consultation":
      return "Link the person in the card below.";
    case "edit_meeting":
      return "Edit meeting details in the card below.";
    case "unlink_person_from_meeting":
      return "Confirm unlinking in the card below.";
    default:
      return "Continuing your request.";
  }
}
