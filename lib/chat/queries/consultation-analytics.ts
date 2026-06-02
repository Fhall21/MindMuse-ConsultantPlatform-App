import { and, desc, eq, ilike, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLog,
  consultations,
  consultationOutputArtifacts,
  consultationGroupMembers,
  meetingPeople,
  meetingGroups,
  meetings,
  people,
  quotes,
  themeMembers,
  themes,
} from "@/db/schema";
import {
  ANALYTICS_INTENTS,
  VALID_INTENTS_LIST,
  type ConsultationDataQuery,
} from "@/lib/chat/tools/analytics";

export const CROSS_MEETING_LIMIT = 20;
export const DEFAULT_LIMIT = 50;

// ── Pure utilities (exported for testing) ─────────────────────────────────────

export function validateAnalyticsIntent(intent: string): string | null {
  if ((ANALYTICS_INTENTS as readonly string[]).includes(intent)) return null;
  return `unknown intent: ${intent}, valid values are [${VALID_INTENTS_LIST}]`;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
}

export function computeWordOverlap(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  const intersection = [...setA].filter((x) => setB.has(x));
  return intersection.length / union.size;
}

export interface ThemeRow {
  id: string;
  label: string;
  description: string | null;
}

export interface OutlierPair {
  theme_a: string;
  theme_b: string;
  overlap_score: number;
}

export function computeLeastSimilarPairs(rows: ThemeRow[], topN: number): OutlierPair[] {
  const pairs: OutlierPair[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i]!;
      const b = rows[j]!;
      pairs.push({
        theme_a: a.label,
        theme_b: b.label,
        overlap_score: computeWordOverlap(
          `${a.label} ${a.description ?? ""}`,
          `${b.label} ${b.description ?? ""}`
        ),
      });
    }
  }
  return pairs.sort((a, b) => a.overlap_score - b.overlap_score).slice(0, topN);
}

// ── Main dispatch ─────────────────────────────────────────────────────────────

export async function executeConsultationQuery(
  input: ConsultationDataQuery,
  userId: string
): Promise<{ intent: string; summary: Record<string, unknown> } | { error: string }> {
  const validationError = validateAnalyticsIntent(input.intent);
  if (validationError) return { error: validationError };

  const { intent, filters } = input;
  const [ownedConsultation] = await db
    .select({ id: consultations.id, label: consultations.label })
    .from(consultations)
    .where(
      and(
        eq(consultations.id, filters.consultation_id),
        eq(consultations.userId, userId)
      )
    )
    .limit(1);

  if (!ownedConsultation) {
    return { error: "Consultation not found." };
  }

  switch (intent) {
    case "consultation_status": {
      const [meetingRows, themeRows, reportRows] = await Promise.all([
        db
          .select({ id: meetings.id, status: meetings.status })
          .from(meetings)
          .where(
            and(
              eq(meetings.consultationId, filters.consultation_id),
              eq(meetings.userId, userId),
              eq(meetings.isArchived, false)
            )
          ),
        db
          .select({ id: themes.id, status: themes.status })
          .from(themes)
          .where(
            and(
              eq(themes.consultationId, filters.consultation_id),
              eq(themes.userId, userId)
            )
          ),
        db
          .select({ id: consultationOutputArtifacts.id })
          .from(consultationOutputArtifacts)
          .where(
            and(
              eq(consultationOutputArtifacts.consultationId, filters.consultation_id),
              eq(consultationOutputArtifacts.userId, userId),
              eq(consultationOutputArtifacts.artifactType, "report")
            )
          ),
      ]);
      return {
        intent,
        summary: {
          consultation: ownedConsultation.label,
          meeting_count: meetingRows.length,
          complete_meeting_count: meetingRows.filter((row) => row.status === "complete").length,
          theme_count: themeRows.length,
          accepted_theme_count: themeRows.filter((row) => row.status === "accepted").length,
          report_count: reportRows.length,
        },
      };
    }

    case "meeting_themes": {
      const rows = await db
        .select({
          theme_label: themes.label,
          theme_description: themes.description,
          meeting_title: meetings.title,
        })
        .from(themeMembers)
        .innerJoin(themes, eq(themes.id, themeMembers.themeId))
        .innerJoin(meetings, eq(meetings.id, themeMembers.sourceMeetingId))
        .where(
          and(
            eq(themeMembers.consultationId, filters.consultation_id),
            eq(themes.userId, userId),
            eq(meetings.userId, userId),
            filters.meeting_id ? eq(meetings.id, filters.meeting_id) : undefined
          )
        )
        .limit(DEFAULT_LIMIT);
      return { intent, summary: { themes: rows } };
    }

    case "evidence_search": {
      const keyword = filters.keyword?.trim();
      if (!keyword) return { error: "Evidence search needs a keyword." };
      const rows = await db
        .select({
          quote_text: quotes.exactText,
          speaker: quotes.speakerLabel,
          meeting_title: meetings.title,
        })
        .from(quotes)
        .innerJoin(meetings, eq(meetings.id, quotes.meetingId))
        .where(
          and(
            eq(meetings.consultationId, filters.consultation_id),
            eq(meetings.userId, userId),
            ilike(quotes.exactText, `%${keyword}%`)
          )
        )
        .limit(DEFAULT_LIMIT);
      return { intent, summary: { keyword, evidence: rows } };
    }

    case "people_roster": {
      const rows = await db
        .select({
          person_id: people.id,
          person_name: people.name,
          meeting_id: meetings.id,
          meeting_title: meetings.title,
        })
        .from(meetingPeople)
        .innerJoin(meetings, eq(meetings.id, meetingPeople.meetingId))
        .innerJoin(people, eq(people.id, meetingPeople.personId))
        .where(
          and(
            eq(meetings.consultationId, filters.consultation_id),
            eq(meetings.userId, userId),
            eq(people.userId, userId)
          )
        )
        .limit(DEFAULT_LIMIT);
      return { intent, summary: { people: rows } };
    }

    case "report_status": {
      const rows = await db
        .select({
          id: consultationOutputArtifacts.id,
          title: consultationOutputArtifacts.title,
          status: consultationOutputArtifacts.status,
          generated_at: consultationOutputArtifacts.generatedAt,
        })
        .from(consultationOutputArtifacts)
        .where(
          and(
            eq(consultationOutputArtifacts.consultationId, filters.consultation_id),
            eq(consultationOutputArtifacts.userId, userId),
            eq(consultationOutputArtifacts.artifactType, "report")
          )
        )
        .orderBy(desc(consultationOutputArtifacts.generatedAt))
        .limit(DEFAULT_LIMIT);
      return { intent, summary: { reports: rows } };
    }

    case "audit_summary": {
      const rows = await db
        .select({
          action: auditLog.action,
          entity_type: auditLog.entityType,
          created_at: auditLog.createdAt,
        })
        .from(auditLog)
        .leftJoin(meetings, eq(meetings.id, auditLog.meetingId))
        .where(
          and(
            eq(auditLog.userId, userId),
            or(
              eq(meetings.consultationId, filters.consultation_id),
              and(
                eq(auditLog.entityType, "consultation"),
                eq(auditLog.entityId, filters.consultation_id)
              ),
              sql`${auditLog.payload} ->> 'consultation_id' = ${filters.consultation_id}`,
              sql`${auditLog.payload} ->> 'consultationId' = ${filters.consultation_id}`
            )
          )
        )
        .orderBy(desc(auditLog.createdAt))
        .limit(DEFAULT_LIMIT);
      return { intent, summary: { events: rows } };
    }

    case "count_themes_by_keyword": {
      const kw = filters.keyword ?? "";
      const rows = await db
        .select({ id: themes.id, label: themes.label })
        .from(themes)
        .where(
          and(
            eq(themes.consultationId, filters.consultation_id),
            kw
              ? or(ilike(themes.label, `%${kw}%`), ilike(themes.description, `%${kw}%`))
              : undefined
          )
        )
        .limit(DEFAULT_LIMIT);
      return {
        intent,
        summary: { count: rows.length, matching_labels: rows.map((r) => r.label) },
      };
    }

    case "group_theme_count": {
      const rows = await db
        .select({
          group_label: meetingGroups.label,
          theme_count: sql<number>`COUNT(DISTINCT ${themeMembers.themeId})`,
        })
        .from(meetingGroups)
        .leftJoin(consultationGroupMembers, eq(consultationGroupMembers.groupId, meetingGroups.id))
        .leftJoin(
          themeMembers,
          and(
            eq(themeMembers.sourceMeetingId, consultationGroupMembers.meetingId),
            eq(themeMembers.consultationId, filters.consultation_id)
          )
        )
        .where(eq(meetingGroups.consultationId, filters.consultation_id))
        .groupBy(meetingGroups.id, meetingGroups.label)
        .orderBy(desc(sql<number>`COUNT(DISTINCT ${themeMembers.themeId})`))
        .limit(DEFAULT_LIMIT);
      return {
        intent,
        summary: {
          groups: rows.map((r) => ({ name: r.group_label, theme_count: Number(r.theme_count) })),
        },
      };
    }

    case "quotes_by_meeting": {
      const rows = await db
        .select({
          meeting_title: meetings.title,
          meeting_id: meetings.id,
          quote_count: sql<number>`COUNT(${quotes.id})`,
        })
        .from(meetings)
        .leftJoin(quotes, eq(quotes.meetingId, meetings.id))
        .where(
          and(
            eq(meetings.consultationId, filters.consultation_id),
            filters.meeting_id ? eq(meetings.id, filters.meeting_id) : undefined
          )
        )
        .groupBy(meetings.id, meetings.title)
        .orderBy(desc(sql<number>`COUNT(${quotes.id})`))
        .limit(DEFAULT_LIMIT);
      return {
        intent,
        summary: {
          meetings: rows.map((r) => ({
            title: r.meeting_title,
            quote_count: Number(r.quote_count),
          })),
        },
      };
    }

    case "cross_meeting_themes": {
      const rows = await db
        .select({
          theme_label: themes.label,
          meeting_count: sql<number>`COUNT(DISTINCT ${themeMembers.sourceMeetingId})`,
        })
        .from(themeMembers)
        .innerJoin(themes, eq(themes.id, themeMembers.themeId))
        .where(eq(themeMembers.consultationId, filters.consultation_id))
        .groupBy(themeMembers.themeId, themes.label)
        .having(sql`COUNT(DISTINCT ${themeMembers.sourceMeetingId}) > 1`)
        .orderBy(desc(sql<number>`COUNT(DISTINCT ${themeMembers.sourceMeetingId})`))
        .limit(CROSS_MEETING_LIMIT);
      return {
        intent,
        summary: {
          themes: rows.map((r) => ({
            label: r.theme_label,
            meeting_count: Number(r.meeting_count),
          })),
        },
      };
    }

    case "person_mention_count": {
      const rows = await db
        .select({
          speaker: quotes.speakerLabel,
          count: sql<number>`COUNT(${quotes.id})`,
        })
        .from(quotes)
        .innerJoin(meetings, eq(meetings.id, quotes.meetingId))
        .where(
          and(
            eq(meetings.consultationId, filters.consultation_id),
            isNotNull(quotes.speakerLabel)
          )
        )
        .groupBy(quotes.speakerLabel)
        .orderBy(desc(sql<number>`COUNT(${quotes.id})`))
        .limit(DEFAULT_LIMIT);
      return {
        intent,
        summary: {
          speakers: rows.map((r) => ({ name: r.speaker, count: Number(r.count) })),
        },
      };
    }

    case "themes_by_person": {
      const rows = await db
        .select({
          quote_text: quotes.exactText,
          speaker: quotes.speakerLabel,
          meeting_title: meetings.title,
        })
        .from(quotes)
        .innerJoin(meetings, eq(meetings.id, quotes.meetingId))
        .where(
          and(
            eq(meetings.consultationId, filters.consultation_id),
            isNotNull(quotes.speakerLabel),
            filters.keyword ? ilike(quotes.exactText, `%${filters.keyword}%`) : undefined,
            filters.person_id ? ilike(quotes.speakerLabel, `%${filters.person_id}%`) : undefined
          )
        )
        .limit(5);
      return {
        intent,
        summary: {
          quotes: rows.map((r) => ({
            text: r.quote_text,
            speaker: r.speaker,
            meeting: r.meeting_title,
          })),
        },
      };
    }

    case "group_outlier_themes": {
      let themeFilter: ReturnType<typeof inArray> | undefined;

      if (filters.group_id) {
        const memberRows = await db
          .select({ meetingId: consultationGroupMembers.meetingId })
          .from(consultationGroupMembers)
          .where(
            and(
              eq(consultationGroupMembers.groupId, filters.group_id),
              eq(consultationGroupMembers.consultationId, filters.consultation_id)
            )
          );

        const meetingIds = memberRows.map((r) => r.meetingId);
        if (meetingIds.length === 0) {
          return {
            intent,
            summary: { least_similar_pairs: [], note: "No themes found in this group." },
          };
        }

        const memberThemeRows = await db
          .select({ themeId: themeMembers.themeId })
          .from(themeMembers)
          .where(
            and(
              eq(themeMembers.consultationId, filters.consultation_id),
              inArray(themeMembers.sourceMeetingId, meetingIds)
            )
          );

        const themeIds = [...new Set(memberThemeRows.map((r) => r.themeId))];
        if (themeIds.length === 0) {
          return {
            intent,
            summary: { least_similar_pairs: [], note: "No themes found in this group." },
          };
        }
        themeFilter = inArray(themes.id, themeIds);
      }

      const themeRows = await db
        .select({ id: themes.id, label: themes.label, description: themes.description })
        .from(themes)
        .where(and(eq(themes.consultationId, filters.consultation_id), themeFilter))
        .limit(DEFAULT_LIMIT);

      const outliers = computeLeastSimilarPairs(themeRows, 3);
      return {
        intent,
        summary: {
          least_similar_pairs: outliers,
          note: "Pairs with lowest word overlap — consultant interprets divergence.",
        },
      };
    }

    case "meeting_activity_summary": {
      const rows = await db
        .select({
          id: meetings.id,
          title: meetings.title,
          theme_count: sql<number>`COUNT(DISTINCT ${themeMembers.themeId})`,
          quote_count: sql<number>`COUNT(DISTINCT ${quotes.id})`,
          participant_count: sql<number>`COUNT(DISTINCT ${quotes.speakerLabel})`,
        })
        .from(meetings)
        .leftJoin(
          themeMembers,
          and(
            eq(themeMembers.sourceMeetingId, meetings.id),
            eq(themeMembers.consultationId, filters.consultation_id)
          )
        )
        .leftJoin(quotes, eq(quotes.meetingId, meetings.id))
        .where(
          and(
            eq(meetings.consultationId, filters.consultation_id),
            filters.meeting_id ? eq(meetings.id, filters.meeting_id) : undefined
          )
        )
        .groupBy(meetings.id, meetings.title)
        .limit(DEFAULT_LIMIT);
      return {
        intent,
        summary: {
          meetings: rows.map((r) => ({
            title: r.title,
            theme_count: Number(r.theme_count),
            quote_count: Number(r.quote_count),
            participant_count: Number(r.participant_count),
          })),
        },
      };
    }

    default:
      intent satisfies never;
      return { error: `unknown intent: ${String(intent)}, valid values are [${VALID_INTENTS_LIST}]` };
  }
}
