"use client";

import { useRef } from "react";
import { buildMeetingActionContinuation } from "@/lib/chat/tools/meeting-action";
import { readMeetingPendingAction } from "@/lib/chat/meeting-pending-action";

export async function confirmMeetingPickerSelection(params: {
  sessionId: string;
  toolResultId: string;
  selectedMeetingId: string;
  toolOutput: unknown;
  toolInput?: unknown;
  pickerToolName: string;
  onSubmitText?: (text: string) => boolean | Promise<boolean>;
  meetingTitle?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const response = await fetch(`/api/chat/tool-results/${params.toolResultId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: params.sessionId,
      meeting_id: params.selectedMeetingId,
      status: "success",
    }),
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    return {
      ok: false,
      error: (json as { detail?: string }).detail ?? "Could not confirm selection",
    };
  }

  const continueResponse = await fetch("/api/chat/meeting-action/continue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: params.sessionId,
      meetingId: params.selectedMeetingId,
      toolResultId: params.toolResultId,
    }),
  });

  if (continueResponse.ok) {
    const payload = (await continueResponse.json()) as {
      action?: string;
      toolResultId?: string;
    };
    if (payload.action && payload.action !== "chat_continue" && payload.toolResultId) {
      return { ok: true };
    }
  }

  if (params.onSubmitText && params.meetingTitle) {
    const sent = await params.onSubmitText(
      buildMeetingActionContinuation(params.meetingTitle)
    );
    if (!sent) {
      return {
        ok: false,
        error: `Meeting saved. Send this to continue: ${buildMeetingActionContinuation(params.meetingTitle)}`,
      };
    }
    return { ok: true };
  }

  const pending = readMeetingPendingAction({
    output: params.toolOutput,
    input: params.toolInput,
    pickerToolName: params.pickerToolName,
  });
  if (pending) {
    return {
      ok: false,
      error: "Meeting saved but the next step did not start. Refresh and try again.",
    };
  }

  return { ok: true };
}

export function useMeetingPickerConfirmLock() {
  const continuedRef = useRef(false);
  return {
    hasContinued: () => continuedRef.current,
    markContinued: () => {
      continuedRef.current = true;
    },
  };
}
