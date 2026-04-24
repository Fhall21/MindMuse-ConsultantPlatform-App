import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  DIGITAL_INTERVIEW_FRAMEWORK_VALUES,
  type DigitalInterviewFramework,
} from "@/lib/digital-interview-frameworks";
import {
  digitalInterviewFlows,
  digitalInterviewResponses,
} from "@/db/schema";
import {
  digitalInterviewGuardrailConfigSchema,
  normalizeGuardrailConfig,
  type DigitalInterviewGuardrailConfig,
  type DigitalInterviewGuardrailSource,
} from "@/lib/digital-interview-guardrails";
import type { DigitalInterviewConversationTurn } from "@/lib/digital-interviews";

export const digitalInterviewFrameworkSchema = z.enum(DIGITAL_INTERVIEW_FRAMEWORK_VALUES);

export const digitalInterviewDepthSchema = z.enum(["surface", "moderate", "deep"]);

export const digitalInterviewFlowStatusSchema = z.enum(["active", "closed"]);

export const digitalInterviewFlowCreateSchema = z
  .object({
    title: z.string().trim().min(1),
    framework: digitalInterviewFrameworkSchema,
    customFrameworkPrompt: z.string().trim().min(1).optional().nullable(),
    topics: z.array(z.string().trim().min(1)).default([]),
    guardrailsConfig: digitalInterviewGuardrailConfigSchema.optional(),
    depthLevel: digitalInterviewDepthSchema.default("moderate"),
    consultationId: z.string().uuid().optional().nullable(),
  })
  .superRefine((value, context) => {
    if (value.framework === "custom" && !value.customFrameworkPrompt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customFrameworkPrompt"],
        message: "Custom framework prompt is required for custom framework",
      });
    }
  });

export const digitalInterviewFlowUpdateSchema = z.object({
  status: digitalInterviewFlowStatusSchema,
});

export const digitalInterviewSessionCreateSchema = z.object({
  sessionToken: z.string().uuid().optional().nullable(),
});

export const digitalInterviewSessionDetailsSchema = z.object({
  name: z.string().trim().min(1),
  role: z.string().trim().min(1),
  workGroup: z.string().trim().min(1),
  organisation: z.string().trim().min(1),
  email: z.string().trim().email().optional().nullable(),
});

export const digitalInterviewMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1),
  timestamp: z.string().datetime().optional(),
});

type DigitalInterviewFlowRow = typeof digitalInterviewFlows.$inferSelect;
type DigitalInterviewResponseRow = typeof digitalInterviewResponses.$inferSelect;

export interface DigitalInterviewFlowListItem {
  id: string;
  user_id: string;
  consultation_id: string | null;
  title: string;
  framework: DigitalInterviewFramework;
  custom_framework_prompt: string | null;
  topics: string[];
  guardrails_config: DigitalInterviewGuardrailConfig;
  depth_level: z.infer<typeof digitalInterviewDepthSchema>;
  status: "draft" | "active" | "closed";
  completed_count: number;
  share_token: string;
  created_at: string;
  updated_at: string;
}

export interface DigitalInterviewResponseSummary {
  id: string;
  flow_id: string;
  interviewee_name: string | null;
  interviewee_role: string | null;
  interviewee_organisation: string | null;
  person_id: string | null;
  status: "in_progress" | "completed" | "abandoned";
  completed_at: string | null;
  created_at: string;
  boundary_moments: DigitalInterviewBoundaryMoment[];
}

export interface DigitalInterviewFlowDetail extends DigitalInterviewFlowListItem {
  responses: DigitalInterviewResponseSummary[];
}

export interface PublicDigitalInterviewFlow {
  id: string;
  title: string;
  framework: DigitalInterviewFramework;
  custom_framework_prompt: string | null;
  topics: string[];
  guardrails_config: DigitalInterviewGuardrailConfig;
  depth_level: z.infer<typeof digitalInterviewDepthSchema>;
  status: "draft" | "active" | "closed";
}

export interface DigitalInterviewResponseRecord {
  id: string;
  flow_id: string;
  session_token: string;
  interviewee_name: string | null;
  interviewee_email: string | null;
  interviewee_role: string | null;
  interviewee_work_group: string | null;
  interviewee_organisation: string | null;
  person_id: string | null;
  person_match_confidence: string | null;
  conversation_history: DigitalInterviewConversationTurn[];
  status: "in_progress" | "completed" | "abandoned";
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DigitalInterviewBoundaryMoment {
  source: DigitalInterviewGuardrailSource;
  label: string;
  reason: string | null;
  turn_index: number;
  timestamp: string | null;
}

export interface PublicDigitalInterviewSessionContext {
  flow: PublicDigitalInterviewFlow;
  session: DigitalInterviewResponseRecord;
}

function toIsoString(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function mapFlowRow(row: DigitalInterviewFlowRow): DigitalInterviewFlowListItem {
  return {
    id: row.id,
    user_id: row.userId,
    consultation_id: row.consultationId,
    title: row.title,
    framework: row.framework as DigitalInterviewFlowListItem["framework"],
    custom_framework_prompt: row.customFrameworkPrompt,
    topics: row.topics ?? [],
    guardrails_config: normalizeGuardrailConfig(row.guardrailsConfig),
    depth_level: row.depthLevel as DigitalInterviewFlowListItem["depth_level"],
    status: row.status as DigitalInterviewFlowListItem["status"],
    completed_count: row.completedCount,
    share_token: row.shareToken,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function mapPublicFlowRow(row: DigitalInterviewFlowRow): PublicDigitalInterviewFlow {
  return {
    id: row.id,
    title: row.title,
    framework: row.framework as PublicDigitalInterviewFlow["framework"],
    custom_framework_prompt: row.customFrameworkPrompt,
    topics: row.topics ?? [],
    guardrails_config: normalizeGuardrailConfig(row.guardrailsConfig),
    depth_level: row.depthLevel as PublicDigitalInterviewFlow["depth_level"],
    status: row.status as PublicDigitalInterviewFlow["status"],
  };
}

function mapResponseRow(row: DigitalInterviewResponseRow): DigitalInterviewResponseRecord {
  return {
    id: row.id,
    flow_id: row.flowId,
    session_token: row.sessionToken,
    interviewee_name: row.intervieweeName,
    interviewee_email: row.intervieweeEmail,
    interviewee_role: row.intervieweeRole,
    interviewee_work_group: row.intervieweeWorkGroup,
    interviewee_organisation: row.intervieweeOrganisation,
    person_id: row.personId,
    person_match_confidence: row.personMatchConfidence,
    conversation_history: row.conversationHistory as DigitalInterviewConversationTurn[],
    status: row.status as DigitalInterviewResponseRecord["status"],
    completed_at: toIsoString(row.completedAt),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function extractBoundaryMoments(
  history: DigitalInterviewConversationTurn[]
): DigitalInterviewBoundaryMoment[] {
  return history.flatMap((turn, index) => {
    const metadata = turn.metadata;
    if (!metadata?.boundaryLabel || !metadata.boundarySource) {
      return [];
    }

    return [
      {
        source: metadata.boundarySource,
        label: metadata.boundaryLabel,
        reason: metadata.boundaryReason ?? null,
        turn_index: index + 1,
        timestamp: turn.timestamp ?? null,
      },
    ];
  });
}

function mapResponseRowSummary(row: DigitalInterviewResponseRow): DigitalInterviewResponseSummary {
  const conversationHistory = row.conversationHistory as DigitalInterviewConversationTurn[];
  return {
    id: row.id,
    flow_id: row.flowId,
    interviewee_name: row.intervieweeName,
    interviewee_role: row.intervieweeRole,
    interviewee_organisation: row.intervieweeOrganisation,
    person_id: row.personId,
    status: row.status as DigitalInterviewResponseSummary["status"],
    completed_at: toIsoString(row.completedAt),
    created_at: row.createdAt.toISOString(),
    boundary_moments: extractBoundaryMoments(conversationHistory),
  };
}

function ensureTimestamp(timestamp?: string): string {
  return timestamp ?? new Date().toISOString();
}

async function getOwnedFlowRow(flowId: string, userId: string) {
  const [flow] = await db
    .select()
    .from(digitalInterviewFlows)
    .where(and(eq(digitalInterviewFlows.id, flowId), eq(digitalInterviewFlows.userId, userId)))
    .limit(1);

  return flow ?? null;
}

async function getPublicFlowRow(shareToken: string) {
  const [flow] = await db
    .select()
    .from(digitalInterviewFlows)
    .where(eq(digitalInterviewFlows.shareToken, shareToken))
    .limit(1);

  return flow ?? null;
}

async function getSessionRow(flowId: string, sessionToken: string) {
  const [response] = await db
    .select()
    .from(digitalInterviewResponses)
    .where(
      and(
        eq(digitalInterviewResponses.flowId, flowId),
        eq(digitalInterviewResponses.sessionToken, sessionToken)
      )
    )
    .limit(1);

  return response ?? null;
}

export async function getPublicDigitalInterviewSessionContext(
  shareToken: string,
  sessionToken: string
): Promise<PublicDigitalInterviewSessionContext | null> {
  const flow = await getPublicFlowRow(shareToken);
  if (!flow) {
    return null;
  }

  const session = await getSessionRow(flow.id, sessionToken);
  if (!session) {
    return null;
  }

  return {
    flow: mapPublicFlowRow(flow),
    session: mapResponseRow(session),
  };
}

export async function listDigitalInterviewFlowsForUser(userId: string) {
  const rows = await db
    .select()
    .from(digitalInterviewFlows)
    .where(eq(digitalInterviewFlows.userId, userId))
    .orderBy(desc(digitalInterviewFlows.createdAt));

  return rows.map(mapFlowRow);
}

export async function countUnreadDigitalInterviewCompletionsForUser(userId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(digitalInterviewResponses)
    .innerJoin(digitalInterviewFlows, eq(digitalInterviewResponses.flowId, digitalInterviewFlows.id))
    .where(
      and(
        eq(digitalInterviewFlows.userId, userId),
        eq(digitalInterviewFlows.status, "active"),
        eq(digitalInterviewResponses.status, "completed"),
        gte(digitalInterviewResponses.createdAt, since)
      )
    );

  return row?.count ?? 0;
}

export async function createDigitalInterviewFlow(
  userId: string,
  input: z.infer<typeof digitalInterviewFlowCreateSchema>
) {
  const [flow] = await db
    .insert(digitalInterviewFlows)
    .values({
      userId,
      consultationId: input.consultationId ?? null,
      title: input.title,
      framework: input.framework,
      customFrameworkPrompt:
        input.framework === "custom" ? input.customFrameworkPrompt ?? null : null,
      topics: input.topics,
      guardrailsConfig: normalizeGuardrailConfig(input.guardrailsConfig),
      depthLevel: input.depthLevel,
    })
    .returning();

  return flow ? mapFlowRow(flow) : null;
}

export async function getDigitalInterviewFlowDetailForUser(
  flowId: string,
  userId: string
): Promise<DigitalInterviewFlowDetail | null> {
  const flow = await getOwnedFlowRow(flowId, userId);
  if (!flow) {
    return null;
  }

  const responses = await db
    .select()
    .from(digitalInterviewResponses)
    .where(
      and(
        eq(digitalInterviewResponses.flowId, flowId),
        eq(digitalInterviewResponses.status, "completed")
      )
    )
    .orderBy(desc(digitalInterviewResponses.createdAt));

  return {
    ...mapFlowRow(flow),
    responses: responses.map(mapResponseRowSummary),
  };
}

export async function getDigitalInterviewResponseTranscript(
  flowId: string,
  responseId: string,
  userId: string
): Promise<DigitalInterviewResponseRecord | null> {
  const flow = await getOwnedFlowRow(flowId, userId);
  if (!flow) return null;

  const [response] = await db
    .select()
    .from(digitalInterviewResponses)
    .where(
      and(
        eq(digitalInterviewResponses.id, responseId),
        eq(digitalInterviewResponses.flowId, flowId),
        eq(digitalInterviewResponses.status, "completed")
      )
    )
    .limit(1);

  return response ? mapResponseRow(response) : null;
}

export async function getDigitalInterviewCompletedResponses(
  flowId: string,
  userId: string
) {
  const flow = await getOwnedFlowRow(flowId, userId);
  if (!flow) return null;

  const responses = await db
    .select()
    .from(digitalInterviewResponses)
    .where(
      and(
        eq(digitalInterviewResponses.flowId, flowId),
        eq(digitalInterviewResponses.status, "completed")
      )
    )
    .orderBy(desc(digitalInterviewResponses.createdAt));

  return { flow: mapFlowRow(flow), responses: responses.map(mapResponseRow) };
}

export async function updateDigitalInterviewFlowStatus(
  flowId: string,
  userId: string,
  status: z.infer<typeof digitalInterviewFlowUpdateSchema>["status"]
) {
  const [flow] = await db
    .update(digitalInterviewFlows)
    .set({ status })
    .where(and(eq(digitalInterviewFlows.id, flowId), eq(digitalInterviewFlows.userId, userId)))
    .returning();

  return flow ? mapFlowRow(flow) : null;
}

export async function closeDigitalInterviewFlow(flowId: string, userId: string) {
  return updateDigitalInterviewFlowStatus(flowId, userId, "closed");
}

export async function getPublicDigitalInterviewFlow(
  shareToken: string
): Promise<PublicDigitalInterviewFlow | null> {
  const flow = await getPublicFlowRow(shareToken);
  return flow ? mapPublicFlowRow(flow) : null;
}

export async function createOrResumeDigitalInterviewSession(
  shareToken: string,
  input: z.infer<typeof digitalInterviewSessionCreateSchema>
) {
  const flow = await getPublicFlowRow(shareToken);
  if (!flow) {
    return null;
  }

  if (flow.status !== "active") {
    return null;
  }

  const existing = input.sessionToken ? await getSessionRow(flow.id, input.sessionToken) : null;
  if (existing && (existing.status === "in_progress" || existing.status === "completed")) {
    return mapResponseRow(existing);
  }

  const sessionToken = randomUUID();

  const [response] = await db
    .insert(digitalInterviewResponses)
    .values({
      flowId: flow.id,
      sessionToken,
    })
    .returning();

  return response ? mapResponseRow(response) : null;
}

export async function updateDigitalInterviewSessionDetails(params: {
  shareToken: string;
  sessionToken: string;
  details: z.infer<typeof digitalInterviewSessionDetailsSchema>;
}) {
  const flow = await getPublicFlowRow(params.shareToken);
  if (!flow || flow.status !== "active") {
    return null;
  }

  const session = await getSessionRow(flow.id, params.sessionToken);
  if (!session || session.status !== "in_progress") {
    return null;
  }

  const [updated] = await db
    .update(digitalInterviewResponses)
    .set({
      intervieweeName: params.details.name,
      intervieweeRole: params.details.role,
      intervieweeWorkGroup: params.details.workGroup,
      intervieweeOrganisation: params.details.organisation,
      intervieweeEmail: params.details.email ?? null,
      updatedAt: new Date(),
    })
    .where(eq(digitalInterviewResponses.id, session.id))
    .returning();

  return updated ? mapResponseRow(updated) : null;
}

export async function appendDigitalInterviewMessage(params: {
  shareToken: string;
  sessionToken: string;
  message: DigitalInterviewConversationTurn;
}) {
  const flow = await getPublicFlowRow(params.shareToken);
  if (!flow) {
    return null;
  }

  if (flow.status !== "active") {
    return null;
  }

  const session = await getSessionRow(flow.id, params.sessionToken);
  if (!session || session.status !== "in_progress") {
    return null;
  }

  const nextHistory = [...session.conversationHistory, params.message];

  const [updated] = await db
    .update(digitalInterviewResponses)
    .set({
      conversationHistory: nextHistory,
      updatedAt: new Date(),
    })
    .where(eq(digitalInterviewResponses.id, session.id))
    .returning();

  return updated ? mapResponseRow(updated) : null;
}

export async function appendDigitalInterviewExchange(params: {
  shareToken: string;
  sessionToken: string;
  userMessage: DigitalInterviewConversationTurn;
  assistantMessage: DigitalInterviewConversationTurn;
}) {
  const flow = await getPublicFlowRow(params.shareToken);
  if (!flow) {
    return null;
  }

  if (flow.status !== "active") {
    return null;
  }

  const session = await getSessionRow(flow.id, params.sessionToken);
  if (!session || session.status !== "in_progress") {
    return null;
  }

  const nextHistory = [
    ...session.conversationHistory,
    params.userMessage,
    params.assistantMessage,
  ];

  const [updated] = await db
    .update(digitalInterviewResponses)
    .set({
      conversationHistory: nextHistory,
      updatedAt: new Date(),
    })
    .where(eq(digitalInterviewResponses.id, session.id))
    .returning();

  return updated ? mapResponseRow(updated) : null;
}

export async function completeDigitalInterviewSession(params: {
  shareToken: string;
  sessionToken: string;
}) {
  const flow = await getPublicFlowRow(params.shareToken);
  if (!flow) {
    return null;
  }

  if (flow.status !== "active") {
    return null;
  }

  const session = await getSessionRow(flow.id, params.sessionToken);
  if (!session) {
    return null;
  }

  if (session.status === "completed") {
    return mapResponseRow(session);
  }

  const now = new Date();

  return db.transaction(async (transaction) => {
    const [completedSession] = await transaction
      .update(digitalInterviewResponses)
      .set({
        status: "completed",
        completedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(digitalInterviewResponses.id, session.id),
          ne(digitalInterviewResponses.status, "completed")
        )
      )
      .returning();

    if (!completedSession) {
      return mapResponseRow(session);
    }

    await transaction
      .update(digitalInterviewFlows)
      .set({
        completedCount: sql`${digitalInterviewFlows.completedCount} + 1`,
        updatedAt: now,
      })
      .where(eq(digitalInterviewFlows.id, flow.id));

    return mapResponseRow(completedSession);
  });
}

export async function formatInterviewSessionTurn(content: string, role: "user" | "assistant") {
  return {
    role,
    content,
    timestamp: ensureTimestamp(),
  } satisfies DigitalInterviewConversationTurn;
}
