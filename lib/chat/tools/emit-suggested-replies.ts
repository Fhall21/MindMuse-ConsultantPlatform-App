import { z } from "zod";
import { isChatCardToolName } from "@/lib/chat/card-tools";
import {
  normalizeGenerativeSuggestedResponses,
  suggestedResponseRoleSchema,
  type GenerativeSuggestedResponsesPayload,
} from "@/lib/chat/suggested-responses";

export const EMIT_SUGGESTED_REPLIES_TOOL_NAME = "emit_suggested_replies";

export const emitSuggestedRepliesSchema = z.object({
  options: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(48),
        prefill: z.string().trim().min(1).max(500),
        confidence: z.number().min(0).max(1),
        role: suggestedResponseRoleSchema.optional(),
      })
    )
    .max(3),
});

export type EmitSuggestedRepliesInput = z.infer<typeof emitSuggestedRepliesSchema>;

export function buildGenerativePayloadFromEmit(
  input: EmitSuggestedRepliesInput
): GenerativeSuggestedResponsesPayload {
  const options = input.options;
  const overallConfidence =
    options.length === 0
      ? 0
      : options.reduce((sum, option) => sum + option.confidence, 0) / options.length;

  return normalizeGenerativeSuggestedResponses({
    source: "generative",
    overallConfidence,
    options,
  });
}

type ToolResultLike = {
  toolName: string;
  output: unknown;
};

type StepLike = {
  toolResults: ToolResultLike[];
};

export function extractGenerativeSuggestedRepliesFromSteps(
  steps: StepLike[]
): GenerativeSuggestedResponsesPayload | null {
  for (let stepIndex = steps.length - 1; stepIndex >= 0; stepIndex -= 1) {
    const step = steps[stepIndex];
    for (let resultIndex = step.toolResults.length - 1; resultIndex >= 0; resultIndex -= 1) {
      const result = step.toolResults[resultIndex];
      if (result?.toolName !== EMIT_SUGGESTED_REPLIES_TOOL_NAME) {
        continue;
      }
      const parsed = emitSuggestedRepliesSchema.safeParse(result.output);
      if (!parsed.success) {
        continue;
      }
      return buildGenerativePayloadFromEmit(parsed.data);
    }
  }
  return null;
}

export function turnIncludesCardToolFromSteps(steps: StepLike[]): boolean {
  for (const step of steps) {
    for (const result of step.toolResults) {
      if (isChatCardToolName(result.toolName)) {
        return true;
      }
    }
  }
  return false;
}
