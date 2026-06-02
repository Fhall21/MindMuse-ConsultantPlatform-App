import { tool } from "ai";
import { z } from "zod";
import {
  resolveNotesFromArtifact,
  resolveTranscriptFromArtifact,
} from "./intake-resolve";
import {
  insertChatMessage,
  insertToolResult,
  loadToolResultsForSession,
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
import { finalizeThemeReview } from "./themes-db";
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
import { selectMeetingForActionSchema } from "./tools/meeting-action";
import { linkPersonToConsultationSchema } from "./tools/people-link";
import { createInsightSchema } from "./tools/insight-create";
import { showReportSchema } from "./tools/report-show";
import { editMeetingSchema } from "./tools/meeting-edit";
import { editThemeSchema } from "./tools/theme-edit";
import { showAuditTrailSchema } from "./tools/audit-trail";
import { exportReportSchema } from "./tools/report-export";
import {
  manipulateCanvasSchema,
  type CanvasOperationProposal,
} from "./tools/canvas-manipulate";
import { queryConsultationDataSchema } from "./tools/analytics";
import { prepareLiteratureReviewSchema } from "./tools/literature-review";
import {
  attachMeetingNoteSchema,
  bulkDismissPendingSchema,
  unlinkPersonFromMeetingSchema,
} from "./tools/nl-actions";
import { executeConsultationQuery } from "./queries/consultation-analytics";
import {
  listMeetingsForConsultation,
  listPeopleForUser,
  getMeetingForUser,
  listInsightsForMeeting,
  listAuditEventsForConsultation,
} from "@/lib/data/domain-read";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  insights,
  consultationOutputArtifacts,
  meetingPeople,
  meetings as meetingsTable,
  people,
} from "@/db/schema";
import { getUnarchivedSessionForUser } from "./context";
import {
  buildMeetingPickerOutput,
} from "./tools/meetings-picker";

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
      description:
        "Show an inline canvas preview for the consultation. Use after grouping or when the user asks to see the canvas. Pass layout_action=arrange for a preview-only auto-layout (does not save). To connect groups or edit edges, direct the user to Open full canvas.",
      inputSchema: previewCanvasSchema,
      execute: async (input) => {
        const parsed = previewCanvasSchema.parse(input);
        const payload = parsed as unknown as Record<string, unknown>;

        try {
          const layout = await buildCanvasLayoutPreview({
            userId: context.userId,
            consultationId: parsed.consultation_id,
            layoutAction: parsed.layout_action,
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

    // ── Sprint 22 Task 01 tools ────────────────────────────────────────────

    select_meeting_for_action: tool({
      description:
        "Show a meeting picker when an action requires a specific meeting to be chosen. Always shows the picker even when only one meeting exists.",
      inputSchema: selectMeetingForActionSchema,
      execute: async (input) => {
        const parsed = selectMeetingForActionSchema.parse(input);
        const payload = parsed as unknown as Record<string, unknown>;

        const session = await getUnarchivedSessionForUser(context.userId, context.sessionId);
        const consultationId = parsed.consultation_id ?? session?.consultationId ?? undefined;

        if (!consultationId) {
          return { error: "No consultation selected. Ask the user to choose a consultation first." };
        }

        const meetings = await listMeetingsForConsultation(consultationId, context.userId);
        if (meetings.length === 0) {
          return { error: "No meetings found in this consultation." };
        }

        const pickerOutput = buildMeetingPickerOutput({
          consultationId,
          meetings: meetings.map((m) => ({
            id: m.id,
            title: m.title,
            date: m.meeting_date ?? null,
          })),
        });

        const toolResult = await persistToolExecution({
          context,
          toolName: "select_meeting_for_action",
          input: payload,
          output: pickerOutput,
          status: "pending",
        });

        return { ...pickerOutput, tool_result_id: toolResult.id };
      },
    }),

    link_person_to_consultation: tool({
      description:
        "Show a person-link card so the user can link an existing person to the current consultation. Use when the user says 'link [name] to this consultation' or similar.",
      inputSchema: linkPersonToConsultationSchema,
      execute: async (input) => {
        const parsed = linkPersonToConsultationSchema.parse(input);
        const payload = parsed as unknown as Record<string, unknown>;

        const session = await getUnarchivedSessionForUser(context.userId, context.sessionId);
        const consultationId = parsed.consultation_id ?? session?.consultationId ?? undefined;

        let meetingId = parsed.meeting_id;
        if (!meetingId && consultationId) {
          const meetings = await listMeetingsForConsultation(consultationId, context.userId);
          if (meetings.length === 1) {
            meetingId = meetings[0].id;
          } else if (meetings.length > 1) {
            return { error: "Multiple meetings found. Use select_meeting_for_action to pick one first." };
          } else {
            return { error: "No meetings found in this consultation." };
          }
        }

        if (!meetingId) {
          return { error: "Could not determine which meeting to link the person to." };
        }

        const allPeople = await listPeopleForUser(context.userId);
        const output = {
          meeting_id: meetingId,
          people: allPeople.map((p) => ({ id: p.id, name: p.name })),
          person_name_hint: parsed.person_name_hint ?? null,
        };

        const toolResult = await persistToolExecution({
          context,
          toolName: "link_person_to_consultation",
          input: payload,
          output,
          status: "pending",
        });

        return { ...output, tool_result_id: toolResult.id };
      },
    }),

    create_insight: tool({
      description:
        "Show an insight-creation card so the user can add a new theme/insight to a meeting. Use when the user says 'add an insight called X' or 'create a theme called X'.",
      inputSchema: createInsightSchema,
      execute: async (input) => {
        const parsed = createInsightSchema.parse(input);
        const payload = parsed as unknown as Record<string, unknown>;

        const session = await getUnarchivedSessionForUser(context.userId, context.sessionId);
        const consultationId = parsed.consultation_id ?? session?.consultationId ?? undefined;

        let meetingId = parsed.meeting_id;
        if (!meetingId && consultationId) {
          const meetings = await listMeetingsForConsultation(consultationId, context.userId);
          if (meetings.length === 1) {
            meetingId = meetings[0].id;
          } else if (meetings.length > 1) {
            return { error: "Multiple meetings found. Use select_meeting_for_action to pick one first." };
          } else {
            return { error: "No meetings found in this consultation." };
          }
        }

        if (!meetingId) {
          return { error: "Could not determine which meeting to add the insight to." };
        }

        const output = {
          meeting_id: meetingId,
          label_hint: parsed.label_hint ?? "",
        };

        const toolResult = await persistToolExecution({
          context,
          toolName: "create_insight",
          input: payload,
          output,
          status: "pending",
        });

        return { ...output, tool_result_id: toolResult.id };
      },
    }),

    show_report: tool({
      description:
        "Show a summary card for the most recent report in this consultation. Use when the user asks to see a report.",
      inputSchema: showReportSchema,
      execute: async (input) => {
        const parsed = showReportSchema.parse(input);
        const payload = parsed as unknown as Record<string, unknown>;

        const session = await getUnarchivedSessionForUser(context.userId, context.sessionId);
        const consultationId = parsed.consultation_id ?? session?.consultationId ?? undefined;

        if (!consultationId) {
          return { error: "No consultation selected. Choose one first." };
        }

        const meetings = await listMeetingsForConsultation(consultationId, context.userId);
        const meetingName = meetings[0]?.title ?? "Meeting";

        const [artifact] = await db
          .select({
            id: consultationOutputArtifacts.id,
            title: consultationOutputArtifacts.title,
            generatedAt: consultationOutputArtifacts.generatedAt,
          })
          .from(consultationOutputArtifacts)
          .where(
            and(
              eq(consultationOutputArtifacts.userId, context.userId),
              eq(consultationOutputArtifacts.consultationId, consultationId),
              eq(consultationOutputArtifacts.artifactType, "report")
            )
          )
          .orderBy(desc(consultationOutputArtifacts.generatedAt))
          .limit(1);

        const output = artifact
          ? {
              report_id: artifact.id,
              title: artifact.title ?? "Report",
              meeting_name: meetingName,
              created_at: artifact.generatedAt?.toISOString() ?? new Date().toISOString(),
              consultation_id: consultationId,
            }
          : { no_report: true, consultation_id: consultationId, meeting_name: meetingName };

        const toolResult = await persistToolExecution({
          context,
          toolName: "show_report",
          input: payload,
          output,
          status: "success",
        });

        return { ...output, tool_result_id: toolResult.id };
      },
    }),

    edit_meeting: tool({
      description:
        "Show a meeting-edit card so the user can update meeting metadata (title, date). Use when the user asks to 'change the date of' or 'rename' a meeting.",
      inputSchema: editMeetingSchema,
      execute: async (input) => {
        const parsed = editMeetingSchema.parse(input);
        const payload = parsed as unknown as Record<string, unknown>;

        const session = await getUnarchivedSessionForUser(context.userId, context.sessionId);
        const consultationId = parsed.consultation_id ?? session?.consultationId ?? undefined;

        let meetingId = parsed.meeting_id;
        if (!meetingId && consultationId) {
          const meetings = await listMeetingsForConsultation(consultationId, context.userId);
          if (meetings.length === 1) {
            meetingId = meetings[0].id;
          } else if (meetings.length > 1) {
            return { error: "Multiple meetings found. Use select_meeting_for_action to pick one first." };
          }
        }

        if (!meetingId) {
          return { error: "This meeting no longer exists or you don't have access." };
        }

        const meeting = await getMeetingForUser(meetingId, context.userId);
        if (!meeting) {
          return { error: "This meeting no longer exists or you don't have access." };
        }

        const output = {
          meeting_id: meeting.id,
          title: meeting.title,
          meeting_date: meeting.meeting_date ?? null,
          meeting_type_id: meeting.meeting_type_id ?? null,
          title_hint: parsed.title_hint ?? null,
          date_hint: parsed.date_hint ?? null,
        };

        const toolResult = await persistToolExecution({
          context,
          toolName: "edit_meeting",
          input: payload,
          output,
          status: "pending",
        });

        return { ...output, tool_result_id: toolResult.id };
      },
    }),

    edit_theme: tool({
      description:
        "Show a theme-edit card so the user can rename or edit the description of an existing insight/theme. Use when the user asks to 'rename' or 'edit' a theme.",
      inputSchema: editThemeSchema,
      execute: async (input) => {
        const parsed = editThemeSchema.parse(input);
        const payload = parsed as unknown as Record<string, unknown>;

        const session = await getUnarchivedSessionForUser(context.userId, context.sessionId);
        const consultationId = parsed.consultation_id ?? session?.consultationId ?? undefined;

        let meetingId = parsed.meeting_id;
        if (!meetingId && consultationId) {
          const meetings = await listMeetingsForConsultation(consultationId, context.userId);
          if (meetings.length === 1) {
            meetingId = meetings[0].id;
          }
        }

        if (parsed.insight_id) {
          const [insight] = await db
            .select({ id: insights.id, label: insights.label, description: insights.description })
            .from(insights)
            .innerJoin(
              meetingsTable,
              and(eq(meetingsTable.id, insights.meetingId), eq(meetingsTable.userId, context.userId))
            )
            .where(eq(insights.id, parsed.insight_id))
            .limit(1);

          if (!insight) {
            return { error: "This theme has been deleted or is no longer accessible." };
          }

          const output = {
            insight_id: insight.id,
            label: insight.label,
            description: insight.description ?? null,
          };

          const toolResult = await persistToolExecution({
            context,
            toolName: "edit_theme",
            input: payload,
            output,
            status: "pending",
          });

          return { ...output, tool_result_id: toolResult.id };
        }

        // No insight_id provided — if we have meeting_id, return all themes for picker
        if (meetingId) {
          const themes = await listInsightsForMeeting(meetingId, context.userId);
          const hintMatch = parsed.label_hint
            ? themes.find((t) => t.label.toLowerCase().includes(parsed.label_hint!.toLowerCase()))
            : null;
          const target = hintMatch ?? themes[0];

          if (!target) {
            return { error: "This theme has been deleted or is no longer accessible." };
          }

          const output = {
            insight_id: target.id,
            label: target.label,
            description: (target as { description?: string | null }).description ?? null,
            all_themes: themes.map((t) => ({ id: t.id, label: t.label })),
          };

          const toolResult = await persistToolExecution({
            context,
            toolName: "edit_theme",
            input: payload,
            output,
            status: "pending",
          });

          return { ...output, tool_result_id: toolResult.id };
        }

        return { error: "Could not find the theme. Provide an insight_id or meeting_id." };
      },
    }),

    show_audit_trail: tool({
      description:
        "Show a timeline card of the last 10 audit events for this consultation. Use when the user asks 'what changed', 'show audit trail', 'what happened this week', etc.",
      inputSchema: showAuditTrailSchema,
      execute: async (input) => {
        const parsed = showAuditTrailSchema.parse(input);
        const payload = parsed as unknown as Record<string, unknown>;

        const session = await getUnarchivedSessionForUser(context.userId, context.sessionId);
        const consultationId =
          parsed.meeting_id ?? parsed.consultation_id ?? session?.consultationId ?? undefined;

        if (!consultationId) {
          return { error: "No consultation selected. Choose one first." };
        }

        try {
          const allEvents = await listAuditEventsForConsultation(consultationId, context.userId);
          const events = allEvents.slice(-10).reverse().map((e) => ({
            id: e.id,
            action: e.action,
            actor_id: e.user_id,
            created_at: e.created_at,
            entity_type: e.entity_type,
            entity_id: e.entity_id,
          }));

          const output = { consultation_id: consultationId, events };

          const toolResult = await persistToolExecution({
            context,
            toolName: "show_audit_trail",
            input: payload,
            output,
            status: "success",
          });

          return { ...output, tool_result_id: toolResult.id };
        } catch {
          return { error: "Couldn't load the audit trail. Refresh or try again." };
        }
      },
    }),

    export_report: tool({
      description:
        "Show an export card so the user can download a report as PDF, Word, or Markdown. Use when the user asks to 'export' or 'download' a report.",
      inputSchema: exportReportSchema,
      execute: async (input) => {
        const parsed = exportReportSchema.parse(input);
        const payload = parsed as unknown as Record<string, unknown>;

        const session = await getUnarchivedSessionForUser(context.userId, context.sessionId);
        const consultationId = parsed.consultation_id ?? session?.consultationId ?? undefined;

        if (!consultationId) {
          return { error: "No consultation selected. Choose one first." };
        }

        const meetings = await listMeetingsForConsultation(consultationId, context.userId);
        const meetingTitle = meetings[0]?.title ?? "Meeting";

        const [artifact] = await db
          .select({ id: consultationOutputArtifacts.id, title: consultationOutputArtifacts.title })
          .from(consultationOutputArtifacts)
          .where(
            and(
              eq(consultationOutputArtifacts.userId, context.userId),
              eq(consultationOutputArtifacts.consultationId, consultationId),
              eq(consultationOutputArtifacts.artifactType, "report")
            )
          )
          .orderBy(desc(consultationOutputArtifacts.generatedAt))
          .limit(1);

        const output = artifact
          ? {
              report_id: artifact.id,
              consultation_title: artifact.title ?? meetingTitle,
              format: parsed.format,
            }
          : {
              no_report: true,
              consultation_id: consultationId,
              consultation_title: meetingTitle,
              format: parsed.format,
            };

        const toolResult = await persistToolExecution({
          context,
          toolName: "export_report",
          input: payload,
          output,
          status: "pending",
        });

        return { ...output, tool_result_id: toolResult.id };
      },
    }),

    // ── Sprint 22 Task 05 — Analytics NL ─────────────────────────────────

    query_consultation_data: tool({
      description:
        "Answer factual questions about the owned consultation using confirmed DB records only. Use for status, themes, evidence, people roster, reports, audit, counts, comparisons, and quote queries. Never hallucinate — only report what the query returns.",
      inputSchema: queryConsultationDataSchema,
      execute: async (input) => {
        const parsed = queryConsultationDataSchema.parse(input);
        return executeConsultationQuery(parsed, context.userId);
      },
    }),

    prepare_literature_review: tool({
      description:
        "Prepare an editable literature-review launch card whenever the user gives a discernible research topic. Population, industry, and setting are optional card refinements; do not block launch to ask for them. Ask one focused question only when the topic itself is missing.",
      inputSchema: prepareLiteratureReviewSchema,
      execute: async (input) => {
        const parsed = prepareLiteratureReviewSchema.parse(input);
        const payload = parsed as unknown as Record<string, unknown>;
        const proposal = {
          query: parsed.query,
          industry_ctx: parsed.industry_ctx ?? null,
        };
        const toolResult = await persistToolExecution({
          context,
          toolName: "prepare_literature_review",
          input: payload,
          output: proposal,
          status: "pending",
        });

        return { ...proposal, tool_result_id: toolResult.id };
      },
    }),

    attach_meeting_note: tool({
      description:
        "Prepare an editable card to append a short note to an owned meeting. Use only when the meeting is clear.",
      inputSchema: attachMeetingNoteSchema,
      execute: async (input) => {
        const parsed = attachMeetingNoteSchema.parse(input);
        const meeting = await getMeetingForUser(parsed.meeting_id, context.userId);
        if (!meeting) return { error: "Meeting not found. Ask which meeting to update." };

        const proposal = {
          meeting_id: parsed.meeting_id,
          meeting_title: meeting.title,
          note: parsed.note,
        };
        const toolResult = await persistToolExecution({
          context,
          toolName: "attach_meeting_note",
          input: parsed as unknown as Record<string, unknown>,
          output: proposal,
          status: "pending",
        });
        return { ...proposal, tool_result_id: toolResult.id };
      },
    }),

    unlink_person_from_meeting: tool({
      description:
        "Prepare a confirmation card to unlink a person from one meeting. If meeting_id is unclear or absent, return the clarification error and ask which meeting before retrying.",
      inputSchema: unlinkPersonFromMeetingSchema,
      execute: async (input) => {
        const parsed = unlinkPersonFromMeetingSchema.parse(input);
        if (!parsed.meeting_id) {
          return { error: "Ask which meeting to unlink the person from." };
        }
        const meeting = await getMeetingForUser(parsed.meeting_id, context.userId);
        if (!meeting) return { error: "Meeting not found. Ask which meeting to use." };
        const linkedPeople = await db
          .select({ id: people.id, name: people.name })
          .from(meetingPeople)
          .innerJoin(people, eq(people.id, meetingPeople.personId))
          .where(
            and(
              eq(meetingPeople.meetingId, parsed.meeting_id),
              eq(people.userId, context.userId)
            )
          );
        const proposal = {
          meeting_id: parsed.meeting_id,
          meeting_title: meeting.title,
          person_name_hint: parsed.person_name_hint,
          people: linkedPeople,
        };
        const toolResult = await persistToolExecution({
          context,
          toolName: "unlink_person_from_meeting",
          input: parsed as unknown as Record<string, unknown>,
          output: proposal,
          status: "pending",
        });
        return { ...proposal, tool_result_id: toolResult.id };
      },
    }),

    bulk_dismiss_pending: tool({
      description:
        "Prepare a warning card to dismiss up to 10 pending chat items. This is destructive and requires card confirmation.",
      inputSchema: bulkDismissPendingSchema,
      execute: async (input) => {
        const parsed = bulkDismissPendingSchema.parse(input);
        const pending = (await loadToolResultsForSession(context.sessionId))
          .filter((result) => result.status === "pending")
          .slice(0, parsed.limit ?? 10)
          .map((result) => ({ id: result.id, tool_name: result.toolName }));
        const proposal = { items: pending };
        const toolResult = await persistToolExecution({
          context,
          toolName: "bulk_dismiss_pending",
          input: parsed as unknown as Record<string, unknown>,
          output: proposal,
          status: "pending",
        });
        return { ...proposal, tool_result_id: toolResult.id };
      },
    }),

    // ── Sprint 22 Task 04 — Canvas NL ─────────────────────────────────────

    manipulate_canvas: tool({
      description:
        "Connect two canvas nodes or rename a canvas frame. Returns a proposal for user confirmation — no DB write until the user confirms on the card. Use node/frame IDs from the [CANVAS CONTEXT] block in the system prompt.",
      inputSchema: manipulateCanvasSchema,
      execute: async (input) => {
        const parsed = manipulateCanvasSchema.parse(input);
        const payload = parsed as unknown as Record<string, unknown>;

        const session = await getUnarchivedSessionForUser(context.userId, context.sessionId);
        const consultationId = parsed.consultation_id ?? session?.consultationId ?? undefined;

        if (!consultationId) {
          return { error: "No consultation selected. Choose one first." };
        }

        const proposal: CanvasOperationProposal = {
          operation: parsed.operation,
          consultation_id: consultationId,
          ...(parsed.operation === "connect"
            ? {
                source_node_id: parsed.source_node_id,
                source_node_label: parsed.source_node_label,
                source_node_type: parsed.source_node_type ?? "theme",
                target_node_id: parsed.target_node_id,
                target_node_label: parsed.target_node_label,
                target_node_type: parsed.target_node_type ?? "theme",
                connection_type: parsed.connection_type ?? "related_to",
              }
            : {
                node_id: parsed.node_id,
                node_label: parsed.node_label,
                new_label: parsed.new_label,
                is_frame: parsed.is_frame,
              }),
        };

        const toolResult = await persistToolExecution({
          context,
          toolName: "manipulate_canvas",
          input: payload,
          output: proposal,
          status: "pending",
        });

        return { ...proposal, tool_result_id: toolResult.id };
      },
    }),
  };
}

export type ChatTools = ReturnType<typeof createChatTools>;
