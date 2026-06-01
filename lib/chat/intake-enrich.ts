import { listMeetingTypes } from "@/lib/actions/meeting-types";
import { dispatchToolToFastApi } from "./tool-dispatch";
import type { ChatToolRuntimeContext } from "./tools";
import type { MeetingDraft } from "./tools/intake";

export async function enrichMeetingDraftWithInfer(params: {
  context: ChatToolRuntimeContext;
  text: string;
  draft: MeetingDraft;
}): Promise<MeetingDraft> {
  let meetingTypes;
  try {
    meetingTypes = await listMeetingTypes();
  } catch {
    return params.draft;
  }

  const inferResult = await dispatchToolToFastApi({
    userId: params.context.userId,
    sessionId: params.context.sessionId,
    endpoint: "/infer/meeting-metadata",
    body: {
      transcript: params.text.slice(0, 12000),
      meeting_type_codes: meetingTypes.map((type) => type.code),
    },
  });

  if (!inferResult.ok) {
    return params.draft;
  }

  const data = inferResult.data as Record<string, unknown>;
  const suggestedTypeCode =
    typeof data.suggested_type_code === "string" ? data.suggested_type_code : undefined;
  const matchedType = suggestedTypeCode
    ? meetingTypes.find((type) => type.code === suggestedTypeCode)
    : undefined;

  const suggestedDate =
    typeof data.suggested_date === "string" && data.suggested_date.trim()
      ? data.suggested_date.trim()
      : undefined;

  const suggestedPeople = Array.isArray(data.suggested_people)
    ? data.suggested_people
        .map((name) => (typeof name === "string" ? name.trim() : ""))
        .filter(Boolean)
    : [];

  return {
    ...params.draft,
    meeting_type_id: matchedType?.id ?? params.draft.meeting_type_id,
    suggested_type_code: suggestedTypeCode ?? params.draft.suggested_type_code,
    date: suggestedDate ? `${suggestedDate}T12:00:00.000Z` : params.draft.date,
    participants:
      suggestedPeople.length > 0 ? suggestedPeople : params.draft.participants,
  };
}
