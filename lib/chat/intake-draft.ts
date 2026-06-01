import { enrichMeetingDraftWithInfer } from "./intake-enrich";
import type { ChatToolRuntimeContext } from "./tools";
import { normalizeMeetingDraft, type MeetingDraft } from "./tools/intake";

/**
 * Build a meeting draft from client-extracted text — same path as meetings/new:
 * local text → infer metadata. Skips FastAPI /transcribe/text (chat service token).
 */
export async function buildMeetingDraftFromExtractedText(params: {
  context: ChatToolRuntimeContext;
  text: string;
  projectId?: string;
  intakeKind: MeetingDraft["intake_kind"];
}): Promise<{ ok: true; draft: MeetingDraft } | { ok: false; error: string }> {
  const trimmed = params.text.trim();
  if (!trimmed) {
    return { ok: false, error: "Transcript text is empty." };
  }

  const baseDraft = normalizeMeetingDraft(
    {
      project_id: params.projectId,
      source_text: trimmed,
      intake_kind: params.intakeKind,
    },
    trimmed
  );

  const enrichedDraft = await enrichMeetingDraftWithInfer({
    context: params.context,
    text: trimmed,
    draft: baseDraft,
  });

  return { ok: true, draft: enrichedDraft };
}
