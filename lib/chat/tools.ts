import { tool } from "ai";
import { z } from "zod";
import { dispatchToolToFastApi } from "./tool-dispatch";
import { CHAT_TOOL_ENDPOINTS } from "./tool-allowlist";
import { insertChatMessage, insertToolResult } from "./persist";

export interface ChatToolRuntimeContext {
  userId: string;
  sessionId: string;
}

function createFastApiTool(
  name: keyof typeof CHAT_TOOL_ENDPOINTS,
  description: string,
  schema: z.ZodObject<z.ZodRawShape>,
  context: ChatToolRuntimeContext
) {
  const endpoint = CHAT_TOOL_ENDPOINTS[name];
  if (!endpoint) {
    throw new Error(`Missing FastAPI endpoint mapping for ${name}`);
  }

  return tool({
    description,
    inputSchema: schema,
    execute: async (input) => {
      const toolMessage = await insertChatMessage({
        sessionId: context.sessionId,
        role: "tool",
        content: JSON.stringify({ tool: name, input }),
        toolCallId: name,
      });

      const result = await dispatchToolToFastApi({
        userId: context.userId,
        sessionId: context.sessionId,
        endpoint,
        body: input as Record<string, unknown>,
      });

      await insertToolResult({
        sessionId: context.sessionId,
        messageId: toolMessage.id,
        toolName: name,
        input: input as Record<string, unknown>,
        output: result.ok ? result.data : { error: result.error },
        status: result.ok ? "success" : "error",
      });

      if (!result.ok) {
        return { error: result.error };
      }

      return result.data;
    },
  });
}

/** 1st-half FastAPI tools. DB-write tools land in Task 04. */
export function createChatTools(context: ChatToolRuntimeContext) {
  return {
    intake_text_transcript: createFastApiTool(
      "intake_text_transcript",
      "Parse pasted transcript into meeting draft",
      z.object({
        text: z.string().min(1),
        title: z.string().optional(),
      }),
      context
    ),
    intake_audio_transcript: createFastApiTool(
      "intake_audio_transcript",
      "Transcribe uploaded audio into meeting draft",
      z.object({
        artifactId: z.string().uuid(),
      }),
      context
    ),
    intake_notes: createFastApiTool(
      "intake_notes",
      "OCR notes image into structured notes draft",
      z.object({
        artifactId: z.string().uuid(),
      }),
      context
    ),
    extract_themes: createFastApiTool(
      "extract_themes",
      "Extract themes from meeting transcript",
      z.object({
        meetingId: z.string().uuid(),
        transcript: z.string().min(1),
      }),
      context
    ),
    generate_clarification: createFastApiTool(
      "generate_clarification",
      "Generate clarification questions for ambiguous notes",
      z.object({
        notes: z.string().min(1),
        meetingId: z.string().uuid().optional(),
      }),
      context
    ),
    identify_quotes: createFastApiTool(
      "identify_quotes",
      "Identify key quotes linked to themes",
      z.object({
        meetingId: z.string().uuid(),
        themeIds: z.array(z.string().uuid()).min(1),
      }),
      context
    ),
  };
}

export type ChatTools = ReturnType<typeof createChatTools>;
