import { tool } from "ai";
import { z } from "zod";
import { confirmMeetingFromDraft, linkPeopleToMeeting } from "./intake-db";
import {
  resolveNotesFromArtifact,
  resolveTranscriptFromArtifact,
} from "./intake-resolve";
import {
  insertChatMessage,
  insertToolResult,
  updateChatMessageContent,
} from "./persist";
import { dispatchToolToFastApi } from "./tool-dispatch";
import { CHAT_TOOL_ENDPOINTS } from "./tool-allowlist";
import {
  confirmMeetingSchema,
  generateClarificationSchema,
  intakeAudioTranscriptSchema,
  intakeNotesSchema,
  intakeTextTranscriptSchema,
  linkPeopleSchema,
  mapClarificationQuestions,
  normalizeMeetingDraft,
  type MeetingDraft,
} from "./tools/intake";
import {
  confirmThemesSchema,
  extractThemesSchema,
} from "./tools/themes";
import { identifyQuotesSchema } from "./tools/quotes";
import { extractAndPersistThemes, finalizeThemeReview } from "./themes-db";
import { identifyAndPersistQuotes } from "./quotes-db";

export interface ChatToolRuntimeContext {
  userId: string;
  sessionId: string;
}

async function persistToolExecution(params: {
  context: ChatToolRuntimeContext;
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  status: "pending" | "success" | "error" | "dismissed";
}) {
  const toolMessage = await insertChatMessage({
    sessionId: params.context.sessionId,
    role: "tool",
    content: JSON.stringify({
      tool: params.toolName,
      input: params.input,
    }),
    toolCallId: params.toolName,
  });

  const row = await insertToolResult({
    sessionId: params.context.sessionId,
    messageId: toolMessage.id,
    toolName: params.toolName,
    input: params.input,
    output: params.output,
    status: params.status,
  });

  await updateChatMessageContent(
    toolMessage.id,
    JSON.stringify({
      tool: params.toolName,
      input: params.input,
      output: params.output,
      status: params.status,
      toolResultId: row.id,
    })
  );

  return row;
}

async function buildMeetingDraftFromText(params: {
  context: ChatToolRuntimeContext;
  text: string;
  projectId?: string;
  intakeKind: MeetingDraft["intake_kind"];
}): Promise<{ ok: true; draft: MeetingDraft } | { ok: false; error: string }> {
  const result = await dispatchToolToFastApi({
    userId: params.context.userId,
    sessionId: params.context.sessionId,
    endpoint: CHAT_TOOL_ENDPOINTS.intake_text_transcript,
    body: {
      text: params.text,
      project_id: params.projectId,
    },
  });

  if (!result.ok) {
    return result;
  }

  const draft = normalizeMeetingDraft(
    {
      ...(result.data as Record<string, unknown>),
      project_id: params.projectId,
      source_text: params.text,
      intake_kind: params.intakeKind,
    },
    params.text
  );

  return { ok: true, draft };
}

function createIntakeTool(
  name: "intake_text_transcript" | "intake_audio_transcript" | "intake_notes",
  description: string,
  schema: z.ZodTypeAny,
  context: ChatToolRuntimeContext,
  resolveText: (input: Record<string, unknown>) => Promise<
    | { ok: true; text: string; projectId?: string; intakeKind: MeetingDraft["intake_kind"] }
    | { ok: false; error: string }
  >
) {
  return tool({
    description,
    inputSchema: schema,
    execute: async (input) => {
      const payload = input as Record<string, unknown>;
      const resolved = await resolveText(payload);
      if (!resolved.ok) {
        await persistToolExecution({
          context,
          toolName: name,
          input: payload,
          output: { error: resolved.error },
          status: "error",
        });
        return { error: resolved.error };
      }

      const draftResult = await buildMeetingDraftFromText({
        context,
        text: resolved.text,
        projectId: resolved.projectId,
        intakeKind: resolved.intakeKind,
      });

      if (!draftResult.ok) {
        await persistToolExecution({
          context,
          toolName: name,
          input: payload,
          output: { error: draftResult.error },
          status: "error",
        });
        return { error: draftResult.error };
      }

      const toolResult = await persistToolExecution({
        context,
        toolName: name,
        input: payload,
        output: draftResult.draft,
        status: "pending",
      });

      return {
        ...draftResult.draft,
        tool_result_id: toolResult.id,
      };
    },
  });
}

function createFastApiTool(
  name: string,
  description: string,
  schema: z.ZodObject<z.ZodRawShape>,
  context: ChatToolRuntimeContext,
  options?: {
    mapBody?: (input: Record<string, unknown>) => Record<string, unknown>;
    mapOutput?: (data: unknown) => unknown;
    status?: "pending" | "success" | "error";
  }
) {
  const endpoint = CHAT_TOOL_ENDPOINTS[name];
  if (!endpoint) {
    throw new Error(`Missing FastAPI endpoint mapping for ${name}`);
  }

  return tool({
    description,
    inputSchema: schema,
    execute: async (input) => {
      const payload = input as Record<string, unknown>;
      const body = options?.mapBody ? options.mapBody(payload) : payload;

      const result = await dispatchToolToFastApi({
        userId: context.userId,
        sessionId: context.sessionId,
        endpoint,
        body,
      });

      const output = result.ok
        ? options?.mapOutput
          ? options.mapOutput(result.data)
          : result.data
        : { error: result.error };

      await persistToolExecution({
        context,
        toolName: name,
        input: payload,
        output,
        status: result.ok ? (options?.status ?? "success") : "error",
      });

      if (!result.ok) {
        return { error: result.error };
      }

      return output;
    },
  });
}

/** Intake + DB-write chat tools for Sprint 21 task 04. */
export function createChatTools(context: ChatToolRuntimeContext) {
  return {
    intake_text_transcript: createIntakeTool(
      "intake_text_transcript",
      "Process a pasted text transcript. Returns a meeting draft for confirmation.",
      intakeTextTranscriptSchema,
      context,
      async (input) => ({
        ok: true,
        text: String(input.text),
        projectId:
          typeof input.project_id === "string" ? input.project_id : undefined,
        intakeKind: "transcript",
      })
    ),
    intake_audio_transcript: createIntakeTool(
      "intake_audio_transcript",
      "Transcribe uploaded audio into a meeting draft for confirmation.",
      intakeAudioTranscriptSchema,
      context,
      async (input) => {
        if (typeof input.text === "string" && input.text.trim()) {
          return {
            ok: true,
            text: input.text.trim(),
            projectId:
              typeof input.project_id === "string" ? input.project_id : undefined,
            intakeKind: "audio",
          };
        }

        if (typeof input.artifactId !== "string") {
          return { ok: false, error: "Audio transcript artifact is required" };
        }

        const transcript = await resolveTranscriptFromArtifact(input.artifactId);
        if (!transcript) {
          return {
            ok: false,
            error: "Audio transcription is not ready yet. Try again shortly.",
          };
        }

        return {
          ok: true,
          text: transcript,
          projectId:
            typeof input.project_id === "string" ? input.project_id : undefined,
          intakeKind: "audio",
        };
      }
    ),
    intake_notes: createIntakeTool(
      "intake_notes",
      "OCR handwritten notes into a meeting draft for confirmation.",
      intakeNotesSchema,
      context,
      async (input) => {
        if (typeof input.text === "string" && input.text.trim()) {
          return {
            ok: true,
            text: input.text.trim(),
            projectId:
              typeof input.project_id === "string" ? input.project_id : undefined,
            intakeKind: "notes",
          };
        }

        if (typeof input.artifactId !== "string") {
          return { ok: false, error: "Notes artifact is required" };
        }

        const notesText = await resolveNotesFromArtifact(input.artifactId);
        if (!notesText) {
          return {
            ok: false,
            error: "Notes extraction is not ready yet. Try again shortly.",
          };
        }

        return {
          ok: true,
          text: notesText,
          projectId:
            typeof input.project_id === "string" ? input.project_id : undefined,
          intakeKind: "notes",
        };
      }
    ),
    confirm_meeting: tool({
      description: "Save confirmed meeting details to the database.",
      inputSchema: confirmMeetingSchema,
      execute: async (input) => {
        const parsed = confirmMeetingSchema.parse(input);
        try {
          const record = await confirmMeetingFromDraft({
            userId: context.userId,
            projectId: parsed.project_id,
            meetingDraft: parsed.meeting_draft,
          });

          if (parsed.meeting_draft.participants.length > 0) {
            await linkPeopleToMeeting({
              userId: context.userId,
              meetingId: record.id,
              participantNames: parsed.meeting_draft.participants,
            });
          }

          await persistToolExecution({
            context,
            toolName: "confirm_meeting",
            input: parsed as unknown as Record<string, unknown>,
            output: record,
            status: "success",
          });

          return record;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to save meeting";
          await persistToolExecution({
            context,
            toolName: "confirm_meeting",
            input: parsed as unknown as Record<string, unknown>,
            output: { error: message },
            status: "error",
          });
          return { error: message };
        }
      },
    }),
    link_people: tool({
      description: "Match participant names to people records and link them to a meeting.",
      inputSchema: linkPeopleSchema,
      execute: async (input) => {
        const parsed = linkPeopleSchema.parse(input);
        try {
          const linked = await linkPeopleToMeeting({
            userId: context.userId,
            meetingId: parsed.meeting_id,
            participantNames: parsed.participant_names,
          });

          await persistToolExecution({
            context,
            toolName: "link_people",
            input: parsed as unknown as Record<string, unknown>,
            output: linked,
            status: "success",
          });

          return linked;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to link people";
          await persistToolExecution({
            context,
            toolName: "link_people",
            input: parsed as unknown as Record<string, unknown>,
            output: { error: message },
            status: "error",
          });
          return { error: message };
        }
      },
    }),
    generate_clarification: createFastApiTool(
      "generate_clarification",
      "Generate clarification questions when notes are ambiguous.",
      generateClarificationSchema,
      context,
      {
        mapBody: (input) => ({
          transcript: input.notes_text,
          themes: [],
          context_notes: `Meeting ID: ${input.meeting_id}`,
        }),
        mapOutput: mapClarificationQuestions,
      }
    ),
    extract_themes: tool({
      description: "Extract themes from a confirmed meeting transcript.",
      inputSchema: extractThemesSchema,
      execute: async (input) => {
        const parsed = extractThemesSchema.parse(input);
        const payload = parsed as unknown as Record<string, unknown>;

        const result = await extractAndPersistThemes({
          userId: context.userId,
          sessionId: context.sessionId,
          meetingId: parsed.meeting_id,
        });

        if (!result.ok) {
          await persistToolExecution({
            context,
            toolName: "extract_themes",
            input: payload,
            output: { error: result.error },
            status: "error",
          });
          return { error: result.error };
        }

        const toolResult = await persistToolExecution({
          context,
          toolName: "extract_themes",
          input: payload,
          output: result.output,
          status: "pending",
        });

        return {
          ...result.output,
          tool_result_id: toolResult.id,
        };
      },
    }),
    confirm_themes: tool({
      description: "Finalize theme review and return accepted themes.",
      inputSchema: confirmThemesSchema,
      execute: async (input) => {
        const parsed = confirmThemesSchema.parse(input);
        try {
          const accepted = await finalizeThemeReview({
            userId: context.userId,
            sessionId: context.sessionId,
            meetingId: parsed.meeting_id,
            acceptedThemeIds: parsed.accepted_theme_ids,
            rejectedThemeIds: parsed.rejected_theme_ids,
          });

          await persistToolExecution({
            context,
            toolName: "confirm_themes",
            input: parsed as unknown as Record<string, unknown>,
            output: { meeting_id: parsed.meeting_id, themes: accepted },
            status: "success",
          });

          return accepted;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to finalize theme review";
          await persistToolExecution({
            context,
            toolName: "confirm_themes",
            input: parsed as unknown as Record<string, unknown>,
            output: { error: message },
            status: "error",
          });
          return { error: message };
        }
      },
    }),
    identify_quotes: tool({
      description:
        "Identify key quotes from a meeting transcript linked to confirmed insights.",
      inputSchema: identifyQuotesSchema,
      execute: async (input) => {
        const parsed = identifyQuotesSchema.parse(input);
        const payload = parsed as unknown as Record<string, unknown>;

        const result = await identifyAndPersistQuotes({
          userId: context.userId,
          sessionId: context.sessionId,
          meetingId: parsed.meeting_id,
          themeIds: parsed.theme_ids,
        });

        if (!result.ok) {
          await persistToolExecution({
            context,
            toolName: "identify_quotes",
            input: payload,
            output: { error: result.error },
            status: "error",
          });
          return { error: result.error };
        }

        const toolResult = await persistToolExecution({
          context,
          toolName: "identify_quotes",
          input: payload,
          output: result.output,
          status: "pending",
        });

        return {
          ...result.output,
          tool_result_id: toolResult.id,
        };
      },
    }),
  };
}

export type ChatTools = ReturnType<typeof createChatTools>;
