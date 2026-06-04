import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { getChatModel } from "@/lib/chat/model";
import {
  generativeSuggestedResponsesSidecarSchema,
  normalizeGenerativeSuggestedResponses,
  type GenerativeSuggestedResponsesPayload,
} from "@/lib/chat/suggested-responses";

export interface GenerateSuggestedResponsesParams {
  assistantText: string;
  recentContext?: string;
}

const SYSTEM_PROMPT = `You suggest short reply chips for a psychosocial consultation chat assistant.
Given the assistant's latest message, propose up to 3 likely user replies the consultant would send next.

Semantic roles (each option MUST use a different role and intent):
- primary (exactly one when a clear yes/proceed path exists): the main affirmative next step.
- defer (optional): not now / skip / later — user postpones the offered step.
- alternate (optional): a different path — e.g. "What else can we do?" when the assistant offered multiple paths.

Rules:
- Max 3 options. They must differ in INTENT, not just wording. Never return three synonyms (e.g. "extract quotes", "show quotes", "proceed with quotes" are ONE intent — keep only primary plus defer/alternate if applicable).
- Labels: max ~4 words, imperative, professional, no exclamation marks, no "Great!" or sycophantic tone.
- Prefill: full message the user would send (can be longer than the label).
- role: required on each option — "primary" | "defer" | "alternate".
- confidence: 0–1 per option; overallConfidence reflects how sure these replies fit the assistant's question.
- Only suggest replies that directly answer what the assistant asked. Do not invent new workflows.
- If the assistant message does not invite a simple reply, return low confidence and empty options.

Examples:
- After themes saved, quotes offered next → primary: ready to identify quotes; defer: "Not yet"; alternate: "What else can we do?"
- After meeting saved, themes offered → primary: extract themes when ready; defer: "Not yet"; alternate: "What else can we do?"`;

/**
 * Sidecar LLM path — deprecated; generative chips use emit_suggested_replies on the main chat turn.
 */
export async function generateSuggestedResponses(
  params: GenerateSuggestedResponsesParams
): Promise<GenerativeSuggestedResponsesPayload> {
  const contextBlock = params.recentContext?.trim()
    ? `\n\nRecent conversation (for context only):\n${params.recentContext.trim()}`
    : "";

  const { object } = await generateObject({
    model: openai(getChatModel()),
    schema: generativeSuggestedResponsesSidecarSchema,
    system: SYSTEM_PROMPT,
    prompt: `Assistant message:\n${params.assistantText.trim()}${contextBlock}`,
  });

  return normalizeGenerativeSuggestedResponses({ source: "generative", ...object });
}
