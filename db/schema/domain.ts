import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const consultationRounds = pgTable(
  "consultation_rounds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("idx_consultation_rounds_user_id").on(table.userId),
  })
);

export const consultations = pgTable(
  "consultations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    transcriptRaw: text("transcript_raw"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").default("draft").notNull(),
    roundId: uuid("round_id").references(() => consultationRounds.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => ({
    statusCheck: check(
      "consultations_status_check",
      sql`${table.status} in ('draft', 'complete')`
    ),
    userIdx: index("idx_consultations_user_id").on(table.userId),
    statusIdx: index("idx_consultations_status").on(table.status),
    roundIdx: index("idx_consultations_round_id").on(table.roundId),
  })
);

export const themes = pgTable(
  "themes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    description: text("description"),
    accepted: boolean("accepted").default(false).notNull(),
    isUserAdded: boolean("is_user_added").default(false).notNull(),
    weight: numeric("weight", { precision: 10, scale: 2 }).default("1.0").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    consultationIdx: index("idx_themes_consultation_id").on(table.consultationId),
    userAddedIdx: index("idx_themes_user_added").on(table.isUserAdded),
  })
);

export const people = pgTable(
  "people",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    workingGroup: text("working_group"),
    workType: text("work_type"),
    role: text("role"),
    email: text("email"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("idx_people_user_id").on(table.userId),
  })
);

export const consultationPeople = pgTable(
  "consultation_people",
  {
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.consultationId, table.personId] }),
  })
);

export const evidenceEmails = pgTable(
  "evidence_emails",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
    subject: text("subject"),
    bodyDraft: text("body_draft"),
    bodyFinal: text("body_final"),
    status: text("status").default("draft").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    statusCheck: check(
      "evidence_emails_status_check",
      sql`${table.status} in ('draft', 'accepted', 'sent')`
    ),
    consultationIdx: index("idx_evidence_emails_consultation_id").on(table.consultationId),
    statusIdx: index("idx_evidence_emails_status").on(table.status),
    consultationStatusIdx: index("idx_evidence_emails_consultation_id_status").on(
      table.consultationId,
      table.status
    ),
  })
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    consultationId: uuid("consultation_id").references(() => consultations.id, {
      onDelete: "cascade",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    payload: jsonb("payload").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => ({
    consultationIdx: index("idx_audit_log_consultation_id").on(table.consultationId),
    userIdx: index("idx_audit_log_user_id").on(table.userId),
    createdAtIdx: index("idx_audit_log_created_at").on(table.createdAt),
    entityTypeIdx: index("idx_audit_log_entity_type").on(table.entityType),
    entityIdIdx: index("idx_audit_log_entity_id").on(table.entityId),
    actionIdx: index("idx_audit_log_action").on(table.action),
  })
);

export const transcriptionJobs = pgTable(
  "transcription_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
    audioFileKey: text("audio_file_key").notNull(),
    status: text("status").default("queued").notNull(),
    transcriptText: text("transcript_text"),
    errorMessage: text("error_message"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    statusCheck: check(
      "transcription_jobs_status_check",
      sql`${table.status} in ('queued', 'processing', 'completed', 'failed')`
    ),
    consultationStatusIdx: index("idx_transcription_jobs_consultation_status").on(
      table.consultationId,
      table.status
    ),
    consultationRequestedIdx: index("idx_transcription_jobs_consultation_requested").on(
      table.consultationId,
      table.requestedAt
    ),
    statusIdx: index("idx_transcription_jobs_status").on(table.status),
  })
);

export const ocrJobs = pgTable(
  "ocr_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
    imageFileKey: text("image_file_key").notNull(),
    status: text("status").default("queued").notNull(),
    extractedText: text("extracted_text"),
    confidenceScore: numeric("confidence_score", { precision: 3, scale: 2 }),
    errorMessage: text("error_message"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    statusCheck: check(
      "ocr_jobs_status_check",
      sql`${table.status} in ('queued', 'processing', 'completed', 'failed')`
    ),
    consultationStatusIdx: index("idx_ocr_jobs_consultation_status").on(
      table.consultationId,
      table.status
    ),
    consultationRequestedIdx: index("idx_ocr_jobs_consultation_requested").on(
      table.consultationId,
      table.requestedAt
    ),
    statusIdx: index("idx_ocr_jobs_status").on(table.status),
  })
);

export const ingestionArtifacts = pgTable(
  "ingestion_artifacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
    artifactType: text("artifact_type").notNull(),
    sourceFileKey: text("source_file_key").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    accepted: boolean("accepted"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => ({
    consultationTypeIdx: index("idx_ingestion_artifacts_consultation_type").on(
      table.consultationId,
      table.artifactType
    ),
    consultationCreatedIdx: index("idx_ingestion_artifacts_consultation_created").on(
      table.consultationId,
      table.createdAt
    ),
    acceptedIdx: index("idx_ingestion_artifacts_accepted").on(table.consultationId, table.accepted),
  })
);

export const themeDecisionLogs = pgTable(
  "theme_decision_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
    themeId: uuid("theme_id").references(() => themes.id, { onDelete: "set null" }),
    roundId: uuid("round_id").references(() => consultationRounds.id, { onDelete: "set null" }),
    decisionType: text("decision_type").notNull(),
    rationale: text("rationale"),
    themeLabel: text("theme_label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    decisionCheck: check(
      "theme_decision_logs_decision_type_check",
      sql`${table.decisionType} in ('accept', 'reject', 'user_added')`
    ),
    userIdx: index("idx_theme_decision_logs_user_id").on(table.userId),
    consultationIdx: index("idx_theme_decision_logs_consultation_id").on(table.consultationId),
    themeIdx: index("idx_theme_decision_logs_theme_id").on(table.themeId),
    roundIdx: index("idx_theme_decision_logs_round_id").on(table.roundId),
    userConsultationCreatedIdx: index("idx_theme_decision_logs_user_consultation_created").on(
      table.userId,
      table.consultationId,
      table.createdAt
    ),
    themeLabelIdx: index("idx_theme_decision_logs_theme_label").on(table.themeLabel),
  })
);

export const roundThemeGroups = pgTable(
  "round_theme_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => consultationRounds.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    description: text("description"),
    status: text("status").default("draft").notNull(),
    origin: text("origin").default("manual").notNull(),
    aiDraftLabel: text("ai_draft_label"),
    aiDraftDescription: text("ai_draft_description"),
    aiDraftExplanation: text("ai_draft_explanation"),
    aiDraftCreatedAt: timestamp("ai_draft_created_at", { withTimezone: true }),
    aiDraftCreatedBy: uuid("ai_draft_created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    lastStructuralChangeAt: timestamp("last_structural_change_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastStructuralChangeBy: uuid("last_structural_change_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => ({
    statusCheck: check(
      "round_theme_groups_status_check",
      sql`${table.status} in ('draft', 'accepted', 'discarded', 'management_rejected')`
    ),
    originCheck: check(
      "round_theme_groups_origin_check",
      sql`${table.origin} in ('manual', 'ai_refined')`
    ),
    roundIdx: index("idx_round_theme_groups_round_id").on(table.roundId),
    userRoundStatusIdx: index("idx_round_theme_groups_user_round_status").on(
      table.userId,
      table.roundId,
      table.status
    ),
  })
);

export const roundThemeGroupMembers = pgTable(
  "round_theme_group_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => roundThemeGroups.id, { onDelete: "cascade" }),
    roundId: uuid("round_id")
      .notNull()
      .references(() => consultationRounds.id, { onDelete: "cascade" }),
    themeId: uuid("theme_id")
      .notNull()
      .references(() => themes.id, { onDelete: "cascade" }),
    sourceConsultationId: uuid("source_consultation_id")
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    position: integer("position").default(0).notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    positionCheck: check("round_theme_group_members_position_check", sql`${table.position} >= 0`),
    roundThemeUnique: unique("round_theme_group_members_round_theme_key").on(
      table.roundId,
      table.themeId
    ),
    roundIdx: index("idx_round_theme_group_members_round_id").on(table.roundId),
    themeIdx: index("idx_round_theme_group_members_theme_id").on(table.themeId),
  })
);

export const roundDecisions = pgTable(
  "round_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => consultationRounds.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    decisionType: text("decision_type").notNull(),
    rationale: text("rationale"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    targetCheck: check(
      "round_decisions_target_type_check",
      sql`${table.targetType} in ('source_theme', 'theme_group', 'round_output')`
    ),
    decisionCheck: check(
      "round_decisions_decision_type_check",
      sql`${table.decisionType} in ('accepted', 'discarded', 'management_rejected')`
    ),
    rationaleCheck: check(
      "round_decisions_management_rejected_requires_rationale",
      sql`${table.decisionType} <> 'management_rejected' or (${table.rationale} is not null and btrim(${table.rationale}) <> '')`
    ),
    roundTargetIdx: index("idx_round_decisions_round_target").on(
      table.roundId,
      table.targetType,
      table.targetId,
      table.createdAt
    ),
  })
);

export const roundOutputArtifacts = pgTable(
  "round_output_artifacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => consultationRounds.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    artifactType: text("artifact_type").notNull(),
    status: text("status").default("generated").notNull(),
    title: text("title"),
    content: text("content").notNull(),
    inputSnapshot: jsonb("input_snapshot")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
    groupId: uuid("group_id"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => ({
    artifactCheck: check(
      "round_output_artifacts_artifact_type_check",
      sql`${table.artifactType} in ('summary', 'report', 'email')`
    ),
    statusCheck: check(
      "round_output_artifacts_status_check",
      sql`${table.status} in ('generated')`
    ),
    roundTypeIdx: index("idx_round_output_artifacts_round_type").on(
      table.roundId,
      table.artifactType,
      table.generatedAt
    ),
  })
);

export const consultationGroups = pgTable(
  "consultation_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => consultationRounds.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    position: integer("position").default(0).notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => ({
    positionCheck: check("consultation_groups_position_check", sql`${table.position} >= 0`),
    roundIdx: index("idx_consultation_groups_round_id").on(table.roundId),
    userRoundIdx: index("idx_consultation_groups_user_round").on(table.userId, table.roundId),
  })
);

export const consultationGroupMembers = pgTable(
  "consultation_group_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => consultationGroups.id, { onDelete: "cascade" }),
    roundId: uuid("round_id")
      .notNull()
      .references(() => consultationRounds.id, { onDelete: "cascade" }),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    position: integer("position").default(0).notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    positionCheck: check("consultation_group_members_position_check", sql`${table.position} >= 0`),
    roundConsultationUnique: unique("consultation_group_members_round_consultation_key").on(
      table.roundId,
      table.consultationId
    ),
    groupIdx: index("idx_consultation_group_members_group_id").on(table.groupId),
    roundIdx: index("idx_consultation_group_members_round_id").on(table.roundId),
    consultationIdx: index("idx_consultation_group_members_consultation_id").on(table.consultationId),
  })
);
