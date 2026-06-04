import { z } from "zod";
import type { UIMessage } from "ai";
import { isChatCardToolName } from "@/lib/chat/card-tools";
import type { ChatMessageMetadata } from "@/db/schema/chat";
import type { ChatToolMessageMeta } from "@/lib/chat/ui-messages";

export const SUGGESTED_RESPONSE_MAX_OPTIONS = 3;
export const SUGGESTED_RESPONSE_OVERALL_CONFIDENCE_MIN = 0.72;
export const SUGGESTED_RESPONSE_OPTION_CONFIDENCE_MIN = 0.65;

export const suggestedResponseRoleSchema = z.enum(["primary", "defer", "alternate"]);
export type SuggestedResponseRole = z.infer<typeof suggestedResponseRoleSchema>;

export type WorkflowSuggestedResponseOption = {
  label: string;
  prefill: string;
  role?: SuggestedResponseRole;
};

export type GenerativeSuggestedResponseOption = {
  label: string;
  prefill: string;
  confidence: number;
  role?: SuggestedResponseRole;
};

/** Display chip — confidence present only for generative payloads. */
export type SuggestedResponseOption =
  | WorkflowSuggestedResponseOption
  | GenerativeSuggestedResponseOption;

export type WorkflowSuggestedResponsesPayload = {
  source: "workflow";
  options: WorkflowSuggestedResponseOption[];
};

export type GenerativeSuggestedResponsesPayload = {
  source: "generative";
  overallConfidence: number;
  options: GenerativeSuggestedResponseOption[];
};

export type SuggestedResponsesPayload =
  | WorkflowSuggestedResponsesPayload
  | GenerativeSuggestedResponsesPayload;

export const workflowSuggestedResponseOptionSchema = z.object({
  label: z.string().trim().min(1).max(48),
  prefill: z.string().trim().min(1).max(500),
  role: suggestedResponseRoleSchema.optional(),
});

export const generativeSuggestedResponseOptionSchema = z.object({
  label: z.string().trim().min(1).max(48),
  prefill: z.string().trim().min(1).max(500),
  confidence: z.number().min(0).max(1),
  role: suggestedResponseRoleSchema.optional(),
});

/** @deprecated Use generativeSuggestedResponseOptionSchema */
export const suggestedResponseOptionSchema = generativeSuggestedResponseOptionSchema;

export const suggestedResponsesPayloadSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("workflow"),
    options: z.array(workflowSuggestedResponseOptionSchema).max(SUGGESTED_RESPONSE_MAX_OPTIONS),
  }),
  z.object({
    source: z.literal("generative"),
    overallConfidence: z.number().min(0).max(1),
    options: z.array(generativeSuggestedResponseOptionSchema).max(SUGGESTED_RESPONSE_MAX_OPTIONS),
  }),
]);

const legacySuggestedResponsesPayloadSchema = z.object({
  overallConfidence: z.number().min(0).max(1),
  options: z.array(generativeSuggestedResponseOptionSchema).max(SUGGESTED_RESPONSE_MAX_OPTIONS),
});

/** Sidecar generateObject schema (deprecated path). */
export const generativeSuggestedResponsesSidecarSchema = legacySuggestedResponsesPayloadSchema;

function optionConfidence(option: SuggestedResponseOption): number {
  return "confidence" in option ? option.confidence : 1;
}

const INVITE_REPLY_PATTERNS: RegExp[] = [
  /\?/,
  /\bready\?\s*$/i,
  /\bwant to\b/i,
  /\bwould you like\b/i,
  /\bshall i\b/i,
  /\bdo you want\b/i,
  /\bshould i\b/i,
  /\bcan i\b/i,
  /\bproceed\b/i,
  /\bgo ahead\b/i,
  /\blet me know\b/i,
  /\bsay when\b/i,
  /\bwhen you(?:'re| are) ready\b/i,
];

const TOKEN_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "can",
  "do",
  "for",
  "from",
  "i",
  "if",
  "in",
  "is",
  "it",
  "me",
  "my",
  "not",
  "of",
  "on",
  "or",
  "so",
  "the",
  "to",
  "up",
  "us",
  "we",
  "with",
  "you",
  "your",
]);

const DEFER_INTENT_PATTERN =
  /\b(not yet|not now|later|skip|wait|hold off|maybe later|come back|another time)\b/i;
const ALTERNATE_INTENT_PATTERN =
  /\b(what else|else can|something else|different|other options?|help me decide|what can you)\b/i;
const PROCEED_INTENT_PATTERN =
  /\b(extract|proceed|yes|ready|go ahead|identify|show|start|continue|review|pull|save)\b/i;

function significantTokens(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const raw of text.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/)) {
    const word = raw.trim();
    if (word.length <= 2 || TOKEN_STOP_WORDS.has(word)) {
      continue;
    }
    tokens.add(word);
  }
  return tokens;
}

function tokenOverlapRatio(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }
  let shared = 0;
  for (const token of left) {
    if (right.has(token)) {
      shared += 1;
    }
  }
  return shared / Math.min(left.size, right.size);
}

export function inferSuggestedResponseRole(
  option: Pick<SuggestedResponseOption, "label" | "prefill" | "role">
): SuggestedResponseRole | "unknown" {
  if (option.role) {
    return option.role;
  }
  const combined = `${option.label} ${option.prefill}`;
  if (DEFER_INTENT_PATTERN.test(combined)) {
    return "defer";
  }
  if (ALTERNATE_INTENT_PATTERN.test(combined)) {
    return "alternate";
  }
  if (PROCEED_INTENT_PATTERN.test(combined)) {
    return "primary";
  }
  return "unknown";
}

export function areSuggestedOptionsTooSimilar(
  left: Pick<SuggestedResponseOption, "label" | "prefill" | "role">,
  right: Pick<SuggestedResponseOption, "label" | "prefill" | "role">
): boolean {
  const leftTokens = significantTokens(`${left.label} ${left.prefill}`);
  const rightTokens = significantTokens(`${right.label} ${right.prefill}`);
  if (tokenOverlapRatio(leftTokens, rightTokens) >= 0.55) {
    return true;
  }

  const leftRole = inferSuggestedResponseRole(left);
  const rightRole = inferSuggestedResponseRole(right);
  if (
    leftRole !== "unknown" &&
    rightRole !== "unknown" &&
    leftRole === rightRole
  ) {
    return true;
  }

  return false;
}

/** Drop synonym chips; keep highest-confidence option per intent. */
export function rejectSemanticallyRedundantOptions<
  T extends Pick<SuggestedResponseOption, "label" | "prefill" | "role">,
>(options: T[]): T[] {
  const sorted = [...options].sort(
    (left, right) => optionConfidence(right) - optionConfidence(left)
  );
  const kept: T[] = [];
  const usedRoles = new Set<SuggestedResponseRole>();

  for (const option of sorted) {
    if (kept.some((existing) => areSuggestedOptionsTooSimilar(option, existing))) {
      continue;
    }
    const role = inferSuggestedResponseRole(option);
    if (role !== "unknown" && usedRoles.has(role)) {
      continue;
    }
    kept.push(option);
    if (role !== "unknown") {
      usedRoles.add(role);
    }
  }

  return kept.slice(0, SUGGESTED_RESPONSE_MAX_OPTIONS);
}

export function normalizeWorkflowSuggestedResponses(
  payload: WorkflowSuggestedResponsesPayload
): WorkflowSuggestedResponsesPayload {
  return {
    source: "workflow",
    options: rejectSemanticallyRedundantOptions(payload.options),
  };
}

export function normalizeGenerativeSuggestedResponses(
  payload: GenerativeSuggestedResponsesPayload
): GenerativeSuggestedResponsesPayload {
  const deduped = rejectSemanticallyRedundantOptions(payload.options);
  const removedCount = payload.options.length - deduped.length;
  const overallConfidence =
    removedCount > 0
      ? Math.min(payload.overallConfidence, payload.overallConfidence * (1 - removedCount * 0.08))
      : payload.overallConfidence;

  return {
    source: "generative",
    overallConfidence,
    options: deduped,
  };
}

/** @deprecated Use normalizeWorkflowSuggestedResponses or normalizeGenerativeSuggestedResponses */
export function normalizeSuggestedResponsesPayload(
  payload: SuggestedResponsesPayload
): SuggestedResponsesPayload {
  if (payload.source === "workflow") {
    return normalizeWorkflowSuggestedResponses(payload);
  }
  return normalizeGenerativeSuggestedResponses(payload);
}

export function invitesReplyHeuristic(assistantText: string): boolean {
  const trimmed = assistantText.trim();
  if (!trimmed) {
    return false;
  }
  return INVITE_REPLY_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function filterDisplayableOptions(
  payload: SuggestedResponsesPayload
): SuggestedResponseOption[] {
  if (payload.source === "workflow") {
    return normalizeWorkflowSuggestedResponses(payload).options.slice(
      0,
      SUGGESTED_RESPONSE_MAX_OPTIONS
    );
  }

  return normalizeGenerativeSuggestedResponses(payload)
    .options.filter((option) => option.confidence >= SUGGESTED_RESPONSE_OPTION_CONFIDENCE_MIN)
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, SUGGESTED_RESPONSE_MAX_OPTIONS);
}

export function shouldDisplaySuggestedResponses(payload: SuggestedResponsesPayload): boolean {
  if (payload.source === "workflow") {
    return filterDisplayableOptions(payload).length > 0;
  }

  if (payload.options.length === 0) {
    return false;
  }
  if (payload.overallConfidence < SUGGESTED_RESPONSE_OVERALL_CONFIDENCE_MIN) {
    return false;
  }
  return filterDisplayableOptions(payload).length > 0;
}

export function parseSuggestedResponsesPayload(
  value: unknown
): SuggestedResponsesPayload | null {
  const parsed = suggestedResponsesPayloadSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  const legacy = legacySuggestedResponsesPayloadSchema.safeParse(value);
  if (legacy.success) {
    return { source: "generative", ...legacy.data };
  }
  return null;
}

export function parseChatMessageMetadata(
  metadata: ChatMessageMetadata | null | undefined
): ChatMessageMetadata | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }
  const suggested = metadata.suggestedResponses;
  if (!suggested) {
    return metadata;
  }
  const parsedPayload = parseSuggestedResponsesPayload(suggested);
  if (!parsedPayload) {
    return null;
  }
  return { suggestedResponses: parsedPayload };
}

export function getSuggestedResponsesFromMetadata(
  metadata: ChatMessageMetadata | null | undefined
): SuggestedResponsesPayload | null {
  const payload = parseSuggestedResponsesPayload(metadata?.suggestedResponses);
  if (!payload || !shouldDisplaySuggestedResponses(payload)) {
    return null;
  }
  const options = filterDisplayableOptions(payload);
  if (payload.source === "workflow") {
    return { source: "workflow", options };
  }
  return {
    source: "generative",
    overallConfidence: payload.overallConfidence,
    options: options as GenerativeSuggestedResponseOption[],
  };
}

export function buildChatMessageMetadata(
  payload: SuggestedResponsesPayload
): ChatMessageMetadata {
  return { suggestedResponses: payload };
}

function getToolMetaFromUiMessage(message: UIMessage): ChatToolMessageMeta | null {
  const metadata = message.metadata as { chatTool?: ChatToolMessageMeta } | undefined;
  return metadata?.chatTool ?? null;
}

export function threadHasPendingInteractiveCard(messages: UIMessage[]): boolean {
  for (const message of messages) {
    const toolMeta = getToolMetaFromUiMessage(message);
    if (!toolMeta || !isChatCardToolName(toolMeta.toolName)) {
      continue;
    }
    const status = toolMeta.status ?? "pending";
    if (status !== "success" && status !== "dismissed" && status !== "error") {
      return true;
    }
  }
  return false;
}

export type BoundSuggestedResponses = {
  messageId: string;
  options: SuggestedResponseOption[];
};

/** Assistant message id suggestions are tied to (skips tool-card-only turns). */
export function getSuggestedResponsesAnchorMessageId(
  messages: UIMessage[]
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "assistant") {
      continue;
    }
    if (getToolMetaFromUiMessage(message)) {
      continue;
    }
    const metadata = message.metadata as ChatMessageMetadata | undefined;
    if (getSuggestedResponsesFromMetadata(metadata)) {
      return message.id;
    }
    const text = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("")
      .trim();
    if (text) {
      return message.id;
    }
  }
  return null;
}

export function areSuggestedResponsesStale(
  bound: Pick<BoundSuggestedResponses, "messageId"> | null,
  lastAssistantMessageId: string | null
): boolean {
  if (!bound) {
    return false;
  }
  if (!lastAssistantMessageId) {
    return true;
  }
  return bound.messageId !== lastAssistantMessageId;
}

export function shouldHideSuggestedResponses(params: {
  view: "home" | "chat";
  hasSession: boolean;
  status: string;
  isBusy: boolean;
  inputTrimmed: string;
  hasPendingCard: boolean;
}): boolean {
  if (params.view !== "chat" || !params.hasSession) {
    return true;
  }
  if (params.status !== "ready" || params.isBusy) {
    return true;
  }
  if (params.inputTrimmed.length > 0) {
    return true;
  }
  if (params.hasPendingCard) {
    return true;
  }
  return false;
}

export function getVisibleSuggestedResponseOptions(
  bound: BoundSuggestedResponses | null,
  lastAssistantMessageId: string | null,
  hide: boolean
): SuggestedResponseOption[] | null {
  if (hide || !bound || !lastAssistantMessageId) {
    return null;
  }
  if (bound.messageId !== lastAssistantMessageId) {
    return null;
  }
  return bound.options.length > 0 ? bound.options : null;
}

export function getSuggestedResponsesFromUiMessages(
  messages: UIMessage[]
): SuggestedResponsesPayload | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "assistant") {
      continue;
    }
    if (getToolMetaFromUiMessage(message)) {
      continue;
    }
    const metadata = message.metadata as ChatMessageMetadata | undefined;
    const fromMeta = getSuggestedResponsesFromMetadata(metadata);
    if (fromMeta) {
      return fromMeta;
    }
    const text = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("")
      .trim();
    if (text) {
      return null;
    }
  }
  return null;
}
