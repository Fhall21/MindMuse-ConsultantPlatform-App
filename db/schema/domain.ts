import {
  bigserial,
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
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const consultations = pgTable(
  "consultations",
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
    userIdx: index("idx_consultations_user_id").on(table.userId),
  })
);

export const meetings = pgTable(
  "meetings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    transcriptRaw: text("transcript_raw"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").default("draft").notNull(),
    consultationId: uuid("consultation_id").references(() => consultations.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => ({
    statusCheck: check(
      "meetings_status_check",
      sql`${table.status} in ('draft', 'complete')`
    ),
    userIdx: index("idx_meetings_user_id").on(table.userId),
    statusIdx: index("idx_meetings_status").on(table.status),
    consultationIdx: index("idx_meetings_consultation_id").on(table.consultationId),
  })
);

export const insights = pgTable(
  "insights",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    description: text("description"),
    accepted: boolean("accepted").default(false).notNull(),
    isUserAdded: boolean("is_user_added").default(false).notNull(),
    weight: numeric("weight", { precision: 10, scale: 2 }).default("1.0").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    meetingIdx: index("idx_insights_meeting_id").on(table.meetingId),
    userAddedIdx: index("idx_insights_user_added").on(table.isUserAdded),
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

export const meetingPeople = pgTable(
  "meeting_people",
  {
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.meetingId, table.personId] }),
  })
);

export const evidenceEmails = pgTable(
  "evidence_emails",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
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
    meetingIdx: index("idx_evidence_emails_meeting_id").on(table.meetingId),
    statusIdx: index("idx_evidence_emails_status").on(table.status),
    meetingStatusIdx: index("idx_evidence_emails_meeting_id_status").on(
      table.meetingId,
      table.status
    ),
  })
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    meetingId: uuid("meeting_id").references(() => meetings.id, {
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
    meetingIdx: index("idx_audit_log_meeting_id").on(table.meetingId),
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
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
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
    meetingStatusIdx: index("idx_transcription_jobs_meeting_status").on(
      table.meetingId,
      table.status
    ),
    meetingRequestedIdx: index("idx_transcription_jobs_meeting_requested").on(
      table.meetingId,
      table.requestedAt
    ),
    statusIdx: index("idx_transcription_jobs_status").on(table.status),
  })
);

export const ocrJobs = pgTable(
  "ocr_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
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
    meetingStatusIdx: index("idx_ocr_jobs_meeting_status").on(
      table.meetingId,
      table.status
    ),
    meetingRequestedIdx: index("idx_ocr_jobs_meeting_requested").on(
      table.meetingId,
      table.requestedAt
    ),
    statusIdx: index("idx_ocr_jobs_status").on(table.status),
  })
);

export const ingestionArtifacts = pgTable(
  "ingestion_artifacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    artifactType: text("artifact_type").notNull(),
    sourceFileKey: text("source_file_key").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    accepted: boolean("accepted"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => ({
    meetingTypeIdx: index("idx_ingestion_artifacts_meeting_type").on(
      table.meetingId,
      table.artifactType
    ),
    meetingCreatedIdx: index("idx_ingestion_artifacts_meeting_created").on(
      table.meetingId,
      table.createdAt
    ),
    acceptedIdx: index("idx_ingestion_artifacts_accepted").on(table.meetingId, table.accepted),
  })
);

export const insightDecisionLogs = pgTable(
  "insight_decision_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    insightId: uuid("insight_id").references(() => insights.id, { onDelete: "set null" }),
    consultationId: uuid("consultation_id").references(() => consultations.id, { onDelete: "set null" }),
    decisionType: text("decision_type").notNull(),
    rationale: text("rationale"),
    insightLabel: text("insight_label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    decisionCheck: check(
      "insight_decision_logs_decision_type_check",
      sql`${table.decisionType} in ('accept', 'reject', 'user_added')`
    ),
    userIdx: index("idx_insight_decision_logs_user_id").on(table.userId),
    meetingIdx: index("idx_insight_decision_logs_meeting_id").on(table.meetingId),
    insightIdx: index("idx_insight_decision_logs_insight_id").on(table.insightId),
    consultationIdx: index("idx_insight_decision_logs_consultation_id").on(table.consultationId),
    userMeetingCreatedIdx: index("idx_insight_decision_logs_user_meeting_created").on(
      table.userId,
      table.meetingId,
      table.createdAt
    ),
    insightLabelIdx: index("idx_insight_decision_logs_insight_label").on(table.insightLabel),
    userCreatedIdx: index("idx_insight_decision_logs_user_created").on(
      table.userId,
      table.createdAt
    ),
  })
);

export const themes = pgTable(
  "themes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
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
      "themes_status_check",
      sql`${table.status} in ('draft', 'accepted', 'discarded', 'management_rejected')`
    ),
    originCheck: check(
      "themes_origin_check",
      sql`${table.origin} in ('manual', 'ai_refined')`
    ),
    consultationIdx: index("idx_themes_consultation_id").on(table.consultationId),
    userConsultationStatusIdx: index("idx_themes_user_consultation_status").on(
      table.userId,
      table.consultationId,
      table.status
    ),
  })
);

export const themeMembers = pgTable(
  "theme_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    themeId: uuid("theme_id")
      .notNull()
      .references(() => themes.id, { onDelete: "cascade" }),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
    insightId: uuid("insight_id")
      .notNull()
      .references(() => insights.id, { onDelete: "cascade" }),
    sourceMeetingId: uuid("source_meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
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
    positionCheck: check("theme_members_position_check", sql`${table.position} >= 0`),
    consultationInsightUnique: unique("theme_members_consultation_insight_key").on(
      table.consultationId,
      table.insightId
    ),
    consultationIdx: index("idx_theme_members_consultation_id").on(table.consultationId),
    insightIdx: index("idx_theme_members_insight_id").on(table.insightId),
  })
);

export const consultationDecisions = pgTable(
  "consultation_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
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
      "consultation_decisions_target_type_check",
      sql`${table.targetType} in ('source_theme', 'theme_group', 'round_output')`
    ),
    decisionCheck: check(
      "consultation_decisions_decision_type_check",
      sql`${table.decisionType} in ('accepted', 'discarded', 'management_rejected')`
    ),
    rationaleCheck: check(
      "consultation_decisions_management_rejected_requires_rationale",
      sql`${table.decisionType} <> 'management_rejected' or (${table.rationale} is not null and btrim(${table.rationale}) <> '')`
    ),
    consultationTargetIdx: index("idx_consultation_decisions_consultation_target").on(
      table.consultationId,
      table.targetType,
      table.targetId,
      table.createdAt
    ),
  })
);

export const consultationOutputArtifacts = pgTable(
  "consultation_output_artifacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
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
      "consultation_output_artifacts_artifact_type_check",
      sql`${table.artifactType} in ('summary', 'report', 'email')`
    ),
    statusCheck: check(
      "consultation_output_artifacts_status_check",
      sql`${table.status} in ('generated')`
    ),
    consultationTypeIdx: index("idx_consultation_output_artifacts_consultation_type").on(
      table.consultationId,
      table.artifactType,
      table.generatedAt
    ),
  })
);

export const meetingGroups = pgTable(
  "meeting_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
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
    positionCheck: check("meeting_groups_position_check", sql`${table.position} >= 0`),
    consultationIdx: index("idx_meeting_groups_consultation_id").on(table.consultationId),
    userConsultationIdx: index("idx_meeting_groups_user_consultation").on(table.userId, table.consultationId),
  })
);

export const consultationGroupMembers = pgTable(
  "consultation_group_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => meetingGroups.id, { onDelete: "cascade" }),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
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
    consultationMeetingUnique: unique("consultation_group_members_consultation_meeting_key").on(
      table.consultationId,
      table.meetingId
    ),
    groupIdx: index("idx_consultation_group_members_group_id").on(table.groupId),
    consultationIdx: index("idx_consultation_group_members_consultation_id").on(table.consultationId),
    meetingIdx: index("idx_consultation_group_members_meeting_id").on(table.meetingId),
  })
);

export const reportTemplates = pgTable(
  "report_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    sections: jsonb("sections")
      .$type<
        Array<{
          heading: string;
          purpose: string;
          prose_guidance: string;
          example_excerpt: string | null;
        }>
      >()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    styleNotes: jsonb("style_notes")
      .$type<{
        tone: string | null;
        person: string | null;
        formatting_notes: string | null;
      }>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    prescriptiveness: text("prescriptiveness").default("moderate").notNull(),
    sourceFileNames: jsonb("source_file_names")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => ({
    prescriptivenessCheck: check(
      "report_templates_prescriptiveness_check",
      sql`${table.prescriptiveness} in ('flexible', 'moderate', 'strict')`
    ),
    userIdx: index("idx_report_templates_user_id").on(table.userId),
    activeIdx: index("idx_report_templates_active").on(table.userId, table.isActive),
  })
);

export const userAIPreferences = pgTable(
  "user_ai_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    consultationTypes: jsonb("consultation_types")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    focusAreas: jsonb("focus_areas")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    excludedTopics: jsonb("excluded_topics")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    ...timestamps,
  },
  (table) => ({
    userIdx: index("idx_user_ai_preferences_user_id").on(table.userId),
  })
);

export const canvasConnections = pgTable(
  "canvas_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fromNodeType: text("from_node_type")
      .notNull()
      .$type<"theme" | "insight" | "person" | "group">(),
    fromNodeId: uuid("from_node_id").notNull(),
    toNodeType: text("to_node_type")
      .notNull()
      .$type<"theme" | "insight" | "person" | "group">(),
    toNodeId: uuid("to_node_id").notNull(),
    connectionType: text("connection_type")
      .notNull()
      .$type<"causes" | "influences" | "supports" | "contradicts" | "related_to">(),
    notes: text("notes"),
    confidence: numeric("confidence", { precision: 4, scale: 3 }),
    origin: text("origin")
      .default("manual")
      .notNull()
      .$type<"manual" | "ai_suggested">(),
    aiSuggestionAcceptedAt: timestamp("ai_suggestion_accepted_at", { withTimezone: true }),
    aiSuggestionRationale: text("ai_suggestion_rationale"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => ({
    fromNodeTypeCheck: check(
      "canvas_connections_from_node_type_check",
      sql`${table.fromNodeType} in ('theme', 'insight', 'person', 'group')`
    ),
    toNodeTypeCheck: check(
      "canvas_connections_to_node_type_check",
      sql`${table.toNodeType} in ('theme', 'insight', 'person', 'group')`
    ),
    connectionTypeCheck: check(
      "canvas_connections_connection_type_check",
      sql`${table.connectionType} in ('causes', 'influences', 'supports', 'contradicts', 'related_to')`
    ),
    originCheck: check(
      "canvas_connections_origin_check",
      sql`${table.origin} in ('manual', 'ai_suggested')`
    ),
    confidenceCheck: check(
      "canvas_connections_confidence_check",
      sql`${table.confidence} is null or (${table.confidence} >= 0 and ${table.confidence} <= 1)`
    ),
    typedEdgeUnique: unique("canvas_connections_typed_edge_unique").on(
      table.consultationId,
      table.fromNodeType,
      table.fromNodeId,
      table.toNodeType,
      table.toNodeId,
      table.connectionType
    ),
    consultationIdx: index("idx_canvas_connections_consultation_id").on(table.consultationId),
    consultationUserIdx: index("idx_canvas_connections_consultation_user").on(table.consultationId, table.userId),
    fromNodeIdx: index("idx_canvas_connections_from_node").on(table.fromNodeType, table.fromNodeId),
    toNodeIdx: index("idx_canvas_connections_to_node").on(table.toNodeType, table.toNodeId),
    originPendingIdx: index("idx_canvas_connections_origin_pending").on(
      table.consultationId,
      table.origin
    ),
  })
);

export const canvasLayoutState = pgTable(
  "canvas_layout_state",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    nodeType: text("node_type")
      .notNull()
      .$type<"theme" | "insight" | "person" | "group" | "viewport">(),
    nodeId: uuid("node_id").notNull(),
    posX: numeric("pos_x", { precision: 10, scale: 2 }),
    posY: numeric("pos_y", { precision: 10, scale: 2 }),
    width: numeric("width", { precision: 10, scale: 2 }),
    height: numeric("height", { precision: 10, scale: 2 }),
    zoom: numeric("zoom", { precision: 6, scale: 4 }),
    panX: numeric("pan_x", { precision: 10, scale: 2 }),
    panY: numeric("pan_y", { precision: 10, scale: 2 }),
    ...timestamps,
  },
  (table) => ({
    nodeTypeCheck: check(
      "canvas_layout_state_node_type_check",
      sql`${table.nodeType} in ('theme', 'insight', 'person', 'group', 'viewport')`
    ),
    nodeUnique: unique("canvas_layout_state_node_unique").on(
      table.consultationId,
      table.userId,
      table.nodeType,
      table.nodeId
    ),
    consultationUserIdx: index("idx_canvas_layout_state_consultation_user").on(table.consultationId, table.userId),
  })
);

export const consultationCrossInsights = pgTable(
  "consultation_cross_insights",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    description: text("description"),
    sourceMeetingIds: jsonb("source_meeting_ids")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => ({
    consultationIdx: index("idx_consultation_cross_insights_consultation_id").on(table.consultationId),
    createdByIdx: index("idx_consultation_cross_insights_created_by").on(table.createdBy),
  })
);

type AnalyticsJobPhase =
  | "queued"
  | "extracting"
  | "embedding"
  | "clustering"
  | "syncing"
  | "complete"
  | "failed";

type AnalyticsExtractor = "langextract" | "spacy" | "combined";

type AnalyticsTermEntityType =
  | "THEME"
  | "ISSUE"
  | "PERSON"
  | "ORG"
  | "LOCATION"
  | "DATE"
  | "OTHER";

type AnalyticsOutboxEventType = "consultation_projection_refresh";

export const analyticsJobs = pgTable(
  "analytics_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    consultationId: uuid("consultation_id").references(() => consultations.id, { onDelete: "set null" }),
    phase: text("phase").default("queued").notNull().$type<AnalyticsJobPhase>(),
    progress: integer("progress").default(-1).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    ...timestamps,
  },
  (table) => ({
    phaseCheck: check(
      "analytics_jobs_phase_check",
      sql`${table.phase} in ('queued', 'extracting', 'embedding', 'clustering', 'syncing', 'complete', 'failed')`
    ),
    progressCheck: check(
      "analytics_jobs_progress_check",
      sql`${table.progress} >= -1 and ${table.progress} <= 100`
    ),
    meetingCreatedIdx: index("idx_analytics_jobs_meeting_created").on(
      table.meetingId,
      table.createdAt.desc()
    ),
    consultationCreatedIdx: index("idx_analytics_jobs_consultation_created").on(
      table.consultationId,
      table.createdAt.desc()
    ),
    activeMeetingIdx: uniqueIndex("idx_analytics_jobs_active_meeting")
      .on(table.meetingId)
      .where(
        sql`${table.phase} in ('queued', 'extracting', 'embedding', 'clustering', 'syncing')`
      ),
  })
);

export const extractionResults = pgTable(
  "extraction_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    consultationId: uuid("consultation_id").references(() => consultations.id, { onDelete: "set null" }),
    extractedAt: timestamp("extracted_at", { withTimezone: true }).defaultNow().notNull(),
    extractor: text("extractor").notNull().$type<AnalyticsExtractor>(),
    modelVersion: text("model_version").notNull(),
    transcriptWordCount: integer("transcript_word_count").notNull(),
    durationMs: integer("duration_ms").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    fallbackUsed: boolean("fallback_used").default(false).notNull(),
    reducedRecall: boolean("reduced_recall").default(false).notNull(),
    errorMessages: jsonb("error_messages")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    resultJson: jsonb("result_json").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    extractorCheck: check(
      "extraction_results_extractor_check",
      sql`${table.extractor} in ('langextract', 'spacy', 'combined')`
    ),
    confidenceCheck: check(
      "extraction_results_confidence_check",
      sql`${table.confidence} >= 0 and ${table.confidence} <= 1`
    ),
    meetingExtractedIdx: index("idx_extraction_results_meeting_extracted").on(
      table.meetingId,
      table.extractedAt.desc()
    ),
    consultationExtractedIdx: index("idx_extraction_results_consultation_extracted").on(
      table.consultationId,
      table.extractedAt.desc()
    ),
  })
);

export const termExtractionOffsets = pgTable(
  "term_extraction_offsets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    extractionResultId: uuid("extraction_result_id")
      .notNull()
      .references(() => extractionResults.id, { onDelete: "cascade" }),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    term: text("term").notNull(),
    original: text("original"),
    entityType: text("entity_type").notNull().$type<AnalyticsTermEntityType>(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    charStart: integer("char_start").notNull(),
    charEnd: integer("char_end").notNull(),
    sourceSpan: text("source_span").notNull(),
    extractionSource: text("extraction_source"),
    posTags: jsonb("pos_tags").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    negationContext: boolean("negation_context").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    entityTypeCheck: check(
      "term_extraction_offsets_entity_type_check",
      sql`${table.entityType} in ('THEME', 'ISSUE', 'PERSON', 'ORG', 'LOCATION', 'DATE', 'OTHER')`
    ),
    confidenceCheck: check(
      "term_extraction_offsets_confidence_check",
      sql`${table.confidence} >= 0 and ${table.confidence} <= 1`
    ),
    charRangeCheck: check(
      "term_extraction_offsets_char_range_check",
      sql`${table.charStart} >= 0 and ${table.charEnd} > ${table.charStart}`
    ),
    meetingCharIdx: index("idx_term_extraction_offsets_meeting_char").on(
      table.meetingId,
      table.charStart
    ),
    extractionResultIdx: index("idx_term_extraction_offsets_extraction_result").on(
      table.extractionResultId
    ),
  })
);

export const termEmbeddings = pgTable(
  "term_embeddings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    term: text("term").notNull(),
    entityType: text("entity_type").notNull().$type<AnalyticsTermEntityType>(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    entityTypeCheck: check(
      "term_embeddings_entity_type_check",
      sql`${table.entityType} in ('THEME', 'ISSUE', 'PERSON', 'ORG', 'LOCATION', 'DATE', 'OTHER')`
    ),
    meetingTermEntityUnique: unique("term_embeddings_meeting_term_entity_key").on(
      table.meetingId,
      table.term,
      table.entityType
    ),
    meetingIdx: index("idx_term_embeddings_meeting_id").on(table.meetingId),
    embeddingCosineIdx: index("idx_term_embeddings_embedding_cosine").using(
      "ivfflat",
      table.embedding.op("vector_cosine_ops")
    ),
  })
);

export const termClusters = pgTable(
  "term_clusters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
    clusterId: integer("cluster_id").notNull(),
    label: text("label").notNull(),
    representativeTerms: jsonb("representative_terms")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    allTerms: jsonb("all_terms").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    meetingCount: integer("meeting_count").notNull(),
    clusteredAt: timestamp("clustered_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    meetingCountCheck: check(
      "term_clusters_meeting_count_check",
      sql`${table.meetingCount} >= 0`
    ),
    consultationClusterUnique: unique("term_clusters_consultation_cluster_key").on(
      table.consultationId,
      table.clusterId
    ),
    consultationClusteredIdx: index("idx_term_clusters_consultation_clustered").on(
      table.consultationId,
      table.clusteredAt.desc()
    ),
  })
);

export const termClusterMemberships = pgTable(
  "term_cluster_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    term: text("term").notNull(),
    clusterId: integer("cluster_id").notNull(),
    membershipProbability: numeric("membership_probability", { precision: 4, scale: 3 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    membershipProbabilityCheck: check(
      "term_cluster_memberships_probability_check",
      sql`${table.membershipProbability} >= 0 and ${table.membershipProbability} <= 1`
    ),
    consultationMeetingTermUnique: unique("term_cluster_memberships_consultation_meeting_term_key").on(
      table.consultationId,
      table.meetingId,
      table.term
    ),
    consultationClusterIdx: index("idx_term_cluster_memberships_consultation_cluster").on(
      table.consultationId,
      table.clusterId
    ),
    meetingIdx: index("idx_term_cluster_memberships_meeting_id").on(table.meetingId),
  })
);

export const analyticsOutbox = pgTable(
  "analytics_outbox",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    consultationId: uuid("consultation_id").references(() => consultations.id, { onDelete: "set null" }),
    eventType: text("event_type")
      .default("consultation_projection_refresh")
      .notNull()
      .$type<AnalyticsOutboxEventType>(),
    sourceTable: text("source_table").default("extraction_results").notNull(),
    sourceId: uuid("source_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    lastError: text("last_error"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    eventTypeCheck: check(
      "analytics_outbox_event_type_check",
      sql`${table.eventType} in ('consultation_projection_refresh')`
    ),
    attemptCountCheck: check(
      "analytics_outbox_attempt_count_check",
      sql`${table.attemptCount} >= 0`
    ),
    pendingIdx: index("idx_analytics_outbox_pending")
      .on(table.id)
      .where(sql`${table.processedAt} is null`),
    meetingCreatedIdx: index("idx_analytics_outbox_meeting_created").on(
      table.meetingId,
      table.createdAt.desc()
    ),
  })
);

export const phases = pgTable(
  "phases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    type: text("type")
      .notNull()
      .$type<"discovery" | "discussion" | "review_feedback">(),
    label: text("label"),
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    typeCheck: check(
      "phases_type_check",
      sql`${table.type} in ('discovery', 'discussion', 'review_feedback')`
    ),
    positionCheck: check("phases_position_check", sql`${table.position} >= 0`),
    meetingIdx: index("idx_phases_meeting_id").on(table.meetingId),
    typeIdx: index("idx_phases_type").on(table.type),
  })
);

export const consultationRounds = meetings;
export const consultationPeople = meetingPeople;
export const roundOutputArtifacts = consultationOutputArtifacts;
export const roundCrossInsights = consultationCrossInsights;
