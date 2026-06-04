import { check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";
import { consultations } from "./domain";

export type ChatUserMode = "onboarding" | "returning";
export type ChatMessageRole = "user" | "assistant" | "tool" | "system";
export type ChatToolResultStatus = "pending" | "success" | "error" | "dismissed";
export type CrossAnalysisJobStatus = "queued" | "running" | "complete" | "error";

export type ChatMessageMetadata = {
  suggestedResponses?: {
    source: "workflow" | "generative";
    overallConfidence?: number;
    options: Array<{
      label: string;
      prefill: string;
      confidence?: number;
      role?: "primary" | "defer" | "alternate";
    }>;
  };
};

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    consultationId: uuid("consultation_id").references(() => consultations.id, {
      onDelete: "set null",
    }),
    userMode: text("user_mode").$type<ChatUserMode>().default("onboarding").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    userModeCheck: check(
      "chat_sessions_user_mode_check",
      sql`${table.userMode} in ('onboarding', 'returning')`
    ),
    userIdx: index("chat_sessions_user_id_idx").on(table.userId),
    consultationIdx: index("chat_sessions_consultation_id_idx").on(table.consultationId),
  })
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    role: text("role").$type<ChatMessageRole>().notNull(),
    content: text("content").notNull(),
    toolCallId: text("tool_call_id"),
    metadata: jsonb("metadata").$type<ChatMessageMetadata | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    roleCheck: check(
      "chat_messages_role_check",
      sql`${table.role} in ('user', 'assistant', 'tool', 'system')`
    ),
    sessionIdx: index("chat_messages_session_id_idx").on(table.sessionId),
  })
);

export const chatToolResults = pgTable(
  "chat_tool_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => chatMessages.id, { onDelete: "cascade" }),
    toolName: text("tool_name").notNull(),
    input: jsonb("input").notNull(),
    output: jsonb("output"),
    status: text("status").$type<ChatToolResultStatus>().default("pending").notNull(),
    seenAt: timestamp("seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    statusCheck: check(
      "chat_tool_results_status_check",
      sql`${table.status} in ('pending', 'success', 'error', 'dismissed')`
    ),
    sessionIdx: index("chat_tool_results_session_id_idx").on(table.sessionId),
    messageIdx: index("chat_tool_results_message_id_idx").on(table.messageId),
  })
);

export const crossAnalysisJobs = pgTable(
  "cross_analysis_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: text("task_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
    status: text("status").$type<CrossAnalysisJobStatus>().default("queued").notNull(),
    results: jsonb("results").$type<Record<string, unknown> | null>(),
    errorMessage: text("error_message"),
    ...timestamps,
  },
  (table) => ({
    statusCheck: check(
      "cross_analysis_jobs_status_check",
      sql`${table.status} in ('queued', 'running', 'complete', 'error')`
    ),
    consultationIdx: index("cross_analysis_jobs_consultation_id_idx").on(table.consultationId),
    userConsultationIdx: index("cross_analysis_jobs_user_consultation_idx").on(
      table.userId,
      table.consultationId
    ),
  })
);
