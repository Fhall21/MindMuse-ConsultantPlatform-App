import { tool } from "ai";
import { z } from "zod";
import {
  resolveNotesFromArtifact,
  resolveTranscriptFromArtifact,
} from "./intake-resolve";
import {
  insertChatMessage,
  insertToolResult,
  updateChatMessageContent,
} from "./persist";
import { buildMeetingDraftFromExtractedText } from "./intake-draft";
import {
  executeExtractThemesTool,
  executeSelectMeetingForThemesTool,
} from "./theme-extract-flow";
import { formatSelectMeetingForThemesToolReturn } from "./theme-tool-returns";
import { dispatchToolToFastApi } from "./tool-dispatch";
import { CHAT_TOOL_ENDPOINTS } from "./tool-allowlist";
import {
  generateClarificationSchema,
  intakeAudioTranscriptSchema,
  intakeNotesSchema,
  intakeTextTranscriptSchema,
  mapClarificationQuestions,
  type MeetingDraft,
} from "./tools/intake";
import {
  confirmThemesSchema,
  extractThemesSchema,
} from "./tools/themes";
import { selectMeetingForThemesSchema } from "./tools/meetings-picker";
import { identifyQuotesSchema } from "./tools/quotes";
import { extractAndPersistThemes, finalizeThemeReview } from "./themes-db";
import { identifyAndPersistQuotes } from "./quotes-db";
import { buildCanvasLayoutPreview } from "./canvas-preview";
import { executeGroupThemesTool, executeLinkInsightsToGroupTool } from "./grouping-db";
import {
  executeDraftEvidenceEmail,
  executeGenerateReport,
  executeGenerateResearchQuestions,
  executeLinkResearchToThemes,
} from "./async-actions-db";
import { groupThemesSchema, linkInsightsToGroupSchema } from "./tools/grouping";
import { previewCanvasSchema } from "./tools/canvas";
import {
  draftEvidenceEmailSchema,
  generateReportSchema,
  generateResearchQuestionsSchema,
  linkResearchToThemesSchema,
} from "./tools/async-actions";

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
  return buildMeetingDraftFromExtractedText(params);
}

export type MeetingIntakeToolName =
  | "intake_text_transcript"
  | "intake_audio_transcript"
  | "intake_notes";

/** Shared intake execution for agent tools and direct upload API. */
export async function executeMeetingIntakeTool(params: {
  context: ChatToolRuntimeContext;
  toolName: MeetingIntakeToolName;
  input: Record<string, unknown>;
  text: string;
  projectId?: string;
  intakeKind: MeetingDraft["intake_kind"];
}) {
  const draftResult = await buildMeetingDraftFromText({
    context: params.context,
    text: params.text,
    projectId: params.projectId,
    intakeKind: params.intakeKind,
  });

  if (!draftResult.ok) {
    await persistToolExecution({
      context: params.context,
      toolName: params.toolName,
      input: params.input,
      output: { error: draftResult.error },
      status: "error",
    });
    return { ok: false as const, error: draftResult.error };
  }

  const toolResult = await persistToolExecution({
    context: params.context,
    toolName: params.toolName,
    input: params.input,
    output: draftResult.draft,
    status: "pending",
  });

  return {
    ok: true as const,
    draft: draftResult.draft,
    toolResultId: toolResult.id,
  };
}

function createIntakeTool(
  name: MeetingIntakeToolName,
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

      const result = await executeMeetingIntakeTool({
        context,
        toolName: name,
        input: payload,
        text: resolved.text,
        projectId: resolved.projectId,
        intakeKind: resolved.intakeKind,
      });

      if (!result.ok) {
        return { error: result.error };
      }

      return {
        ...result.draft,
        tool_result_id: result.toolResultId,
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
        mapOutput: (data) => ({
          questions: mapClarificationQuestions(data),
        }),
        status: "pending",
      }
    ),
    extract_themes: tool({
      description:
        "Extract themes from a confirmed meeting transcript. Omit meeting_id to use the active consultation's last saved meeting or show a picker card.",
      inputSchema: extractThemesSchema,
      execute: async (input) => {
        const parsed = extractThemesSchema.parse(input);
        return executeExtractThemesTool({
          context,
          meetingId: parsed.meeting_id,
        });
      },
    }),
    select_meeting_for_themes: tool({
      description:
        "Show a consultation-scoped meeting picker when theme extraction needs a meeting choice.",
      inputSchema: selectMeetingForThemesSchema,
      execute: async () =>
        formatSelectMeetingForThemesToolReturn(
          await executeSelectMeetingForThemesTool({ context })
        ),
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
    group_themes: tool({
      description:
        "Propose a new theme group by clustering relevant insights. Use when the user wants AI-suggested groupings or to create a new group from scratch.",
      inputSchema: groupThemesSchema,
      execute: async (input) => {
        const parsed = groupThemesSchema.parse(input);
        const payload = parsed as unknown as Record<string, unknown>;

        const result = await executeGroupThemesTool({
          userId: context.userId,
          sessionId: context.sessionId,
          consultationId: parsed.project_id,
          hint: parsed.hint,
        });

        if (!result.ok) {
          await persistToolExecution({
            context,
            toolName: "group_themes",
            input: payload,
            output: { error: result.error },
            status: "error",
          });
          return { error: result.error };
        }

        const toolResult = await persistToolExecution({
          context,
          toolName: "group_themes",
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
    link_insights_to_group: tool({
      description:
        "Link many insights to an existing theme group the user already named. Use when they refer to a specific group and want to connect insights to it.",
      inputSchema: linkInsightsToGroupSchema,
      execute: async (input) => {
        const parsed = linkInsightsToGroupSchema.parse(input);
        const payload = parsed as unknown as Record<string, unknown>;

        const result = await executeLinkInsightsToGroupTool({
          userId: context.userId,
          consultationId: parsed.project_id,
          groupName: parsed.group_name,
          groupId: parsed.group_id,
          hint: parsed.hint,
          insightIds: parsed.insight_ids,
        });

        if (!result.ok) {
          await persistToolExecution({
            context,
            toolName: "link_insights_to_group",
            input: payload,
            output: { error: result.error },
            status: "error",
          });
          return { error: result.error };
        }

        const toolResult = await persistToolExecution({
          context,
          toolName: "link_insights_to_group",
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
    preview_canvas: tool({
      description: "Generate a canvas layout preview for the current consultation.",
      inputSchema: previewCanvasSchema,
      execute: async (input) => {
        const parsed = previewCanvasSchema.parse(input);
        const payload = parsed as unknown as Record<string, unknown>;

        try {
          const layout = await buildCanvasLayoutPreview({
            userId: context.userId,
            consultationId: parsed.consultation_id,
          });

          await persistToolExecution({
            context,
            toolName: "preview_canvas",
            input: payload,
            output: layout,
            status: "success",
          });

          return layout;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to build canvas preview";
          await persistToolExecution({
            context,
            toolName: "preview_canvas",
            input: payload,
            output: { error: message },
            status: "error",
          });
          return { error: message };
        }
      },
    }),
    generate_research_questions: tool({
      description: "Generate research questions based on extracted themes.",
      inputSchema: generateResearchQuestionsSchema,
      execute: async (input) => {
        const parsed = generateResearchQuestionsSchema.parse(input);
        const payload = parsed as unknown as Record<string, unknown>;
        const result = await executeGenerateResearchQuestions({
          userId: context.userId,
          sessionId: context.sessionId,
          consultationId: parsed.consultation_id,
          themeIds: parsed.theme_ids,
        });

        if (!result.ok) {
          await persistToolExecution({
            context,
            toolName: "generate_research_questions",
            input: payload,
            output: { error: result.error },
            status: "error",
          });
          return { error: result.error };
        }

        const toolResult = await persistToolExecution({
          context,
          toolName: "generate_research_questions",
          input: payload,
          output: result.output,
          status: "pending",
        });

        return { ...result.output, tool_result_id: toolResult.id };
      },
    }),
    draft_evidence_email: tool({
      description: "Draft an evidence email for a consultation engagement.",
      inputSchema: draftEvidenceEmailSchema,
      execute: async (input) => {
        const parsed = draftEvidenceEmailSchema.parse(input);
        const payload = parsed as unknown as Record<string, unknown>;
        const result = await executeDraftEvidenceEmail({
          userId: context.userId,
          sessionId: context.sessionId,
          consultationId: parsed.consultation_id,
          meetingIds: parsed.meeting_ids,
        });

        if (!result.ok) {
          await persistToolExecution({
            context,
            toolName: "draft_evidence_email",
            input: payload,
            output: { error: result.error },
            status: "error",
          });
          return { error: result.error };
        }

        const toolResult = await persistToolExecution({
          context,
          toolName: "draft_evidence_email",
          input: payload,
          output: result.output,
          status: "pending",
        });

        return { ...result.output, tool_result_id: toolResult.id };
      },
    }),
    generate_report: tool({
      description: "Generate a consultation report for a consultation.",
      inputSchema: generateReportSchema,
      execute: async (input) => {
        const parsed = generateReportSchema.parse(input);
        const payload = parsed as unknown as Record<string, unknown>;
        const result = await executeGenerateReport({
          userId: context.userId,
          sessionId: context.sessionId,
          consultationId: parsed.consultation_id,
        });

        if (!result.ok) {
          await persistToolExecution({
            context,
            toolName: "generate_report",
            input: payload,
            output: { error: result.error },
            status: "error",
          });
          return { error: result.error };
        }

        const toolResult = await persistToolExecution({
          context,
          toolName: "generate_report",
          input: payload,
          output: result.output,
          status: "pending",
        });

        return { ...result.output, tool_result_id: toolResult.id };
      },
    }),
    link_research_to_themes: tool({
      description:
        "Find and link a research insight to the most relevant theme groups.",
      inputSchema: linkResearchToThemesSchema,
      execute: async (input) => {
        const parsed = linkResearchToThemesSchema.parse(input);
        const payload = parsed as unknown as Record<string, unknown>;
        const result = await executeLinkResearchToThemes({
          userId: context.userId,
          consultationId: parsed.consultation_id,
          researchId: parsed.research_id,
        });

        if (!result.ok) {
          await persistToolExecution({
            context,
            toolName: "link_research_to_themes",
            input: payload,
            output: { error: result.error },
            status: "error",
          });
          return { error: result.error };
        }

        const toolResult = await persistToolExecution({
          context,
          toolName: "link_research_to_themes",
          input: payload,
          output: result.output,
          status: "pending",
        });

        return { ...result.output, tool_result_id: toolResult.id };
      },
    }),
  };
}

export type ChatTools = ReturnType<typeof createChatTools>;
