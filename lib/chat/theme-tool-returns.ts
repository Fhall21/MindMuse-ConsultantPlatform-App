import type { ThemeReviewOutput } from "./tools/themes";
import type { MeetingPickerOutput } from "./tools/meetings-picker";

export function formatThemeExtractionToolReturn(result: {
  ok: boolean;
  error?: string;
  output?: ThemeReviewOutput;
  toolResultId?: string;
}) {
  if (!result.ok) {
    return { error: result.error ?? "Theme extraction failed" };
  }

  return {
    ...result.output,
    tool_result_id: result.toolResultId,
  };
}

export function formatMeetingPickerToolReturn(result: {
  ok: boolean;
  error?: string;
  picker?: boolean;
  output?: MeetingPickerOutput | ThemeReviewOutput;
  toolResultId?: string;
}) {
  if (!result.ok) {
    return { error: result.error ?? "Meeting selection failed" };
  }

  if (result.picker && result.output) {
    return {
      ...result.output,
      tool_result_id: result.toolResultId,
      picker: true,
    };
  }

  if (result.output && result.toolResultId) {
    return formatThemeExtractionToolReturn({
      ok: true,
      output: result.output as ThemeReviewOutput,
      toolResultId: result.toolResultId,
    });
  }

  return { error: "Unexpected meeting picker result" };
}

export function formatSelectMeetingForThemesToolReturn(
  result: Parameters<typeof formatMeetingPickerToolReturn>[0]
) {
  return formatMeetingPickerToolReturn(result);
}
