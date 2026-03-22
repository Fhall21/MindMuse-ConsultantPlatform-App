"use server";

import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLog,
  meetingPeople as consultationPeople,
  meetings as consultationRounds,
  consultations,
  consultationOutputArtifacts as roundOutputArtifacts,
  evidenceEmails,
  insights,
  meetings,
  people,
  themes,
} from "@/db/schema";
import type {
  AuditLogEntry,
  Consultation,
  ConsultationRound,
  EvidenceEmail,
  Insight,
  Meeting,
  Person,
  RoundOutputArtifact,
  Theme,
} from "@/types/db";
import {
  mapAuditLogRecord,
  mapConsultationRecord,
  mapConsultationRoundRecord,
  mapEvidenceEmailRecord,
  mapInsightRecord,
  mapMeetingRecord,
  mapPersonRecord,
  mapRoundOutputArtifactRecord,
  mapThemeRecord,
} from "./mappers";
import {
  requireOwnedConsultation,
  requireOwnedMeeting,
  requireOwnedPerson,
  requireOwnedRound,
} from "./ownership";

function uniqueIds(ids: string[]) {
  return [...new Set(ids.filter(Boolean))];
}

export interface AuditEventFilters {
  actorUserId?: string | null;
  consultationId?: string | null;
  consultationIds?: string[];
  dateFromIso?: string | null;
  dateToIso?: string | null;
  action?: string | null;
  ascending?: boolean;
}

export async function listConsultationsForUser(
  userId: string
): Promise<Consultation[]> {
  const rows = await db
    .select()
    .from(consultations)
    .where(eq(consultations.userId, userId))
    .orderBy(desc(consultations.createdAt));

  return rows.map(mapConsultationRecord);
}

export async function listConsultationsByIdsForUser(
  consultationIds: string[],
  userId: string
): Promise<Consultation[]> {
  const ids = uniqueIds(consultationIds);
  if (ids.length === 0) {
    return [];
  }

  const rows = await db
    .select()
    .from(consultations)
    .where(
      and(
        eq(consultations.userId, userId),
        inArray(consultations.id, ids)
      )
    )
    .orderBy(asc(consultations.createdAt));

  return rows.map(mapConsultationRecord);
}

export async function getConsultationForUser(
  consultationId: string,
  userId: string
): Promise<Consultation | null> {
  const [row] = await db
    .select()
    .from(consultations)
    .where(
      and(
        eq(consultations.id, consultationId),
        eq(consultations.userId, userId)
      )
    )
    .limit(1);

  return row ? mapConsultationRecord(row) : null;
}

interface MeetingReadOptions {
  includeArchived?: boolean;
}

export async function listMeetingsForUser(
  userId: string,
  options: MeetingReadOptions = {}
): Promise<Meeting[]> {
  const conditions = [eq(meetings.userId, userId)];
  if (!options.includeArchived) {
    conditions.push(eq(meetings.isArchived, false));
  }

  const rows = await db
    .select()
    .from(meetings)
    .where(and(...conditions))
    .orderBy(desc(meetings.createdAt));

  return rows.map(mapMeetingRecord);
}

export async function getMeetingForUser(
  meetingId: string,
  userId: string
): Promise<Meeting | null> {
  const [row] = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)))
    .limit(1);

  return row ? mapMeetingRecord(row) : null;
}

export async function listMeetingsForConsultation(
  consultationId: string,
  userId: string,
  options: MeetingReadOptions = {}
): Promise<Meeting[]> {
  await requireOwnedConsultation(consultationId, userId);

  const conditions = [
    eq(meetings.consultationId, consultationId),
    eq(meetings.userId, userId),
  ];
  if (!options.includeArchived) {
    conditions.push(eq(meetings.isArchived, false));
  }

  const rows = await db
    .select()
    .from(meetings)
    .where(and(...conditions))
    .orderBy(asc(meetings.createdAt));

  return rows.map(mapMeetingRecord);
}

export async function listMeetingsForConsultationGroup(
  consultationId: string,
  userId: string
): Promise<ConsultationRound[]> {
  await requireOwnedRound(consultationId, userId);

  const rows = await db
    .select()
    .from(consultationRounds)
    .where(
      and(
        eq(consultationRounds.consultationId, consultationId),
        eq(consultationRounds.userId, userId)
      )
    )
    .orderBy(asc(consultationRounds.createdAt));

  return rows.map(mapConsultationRoundRecord);
}

export async function listConsultationsForRound(
  roundId: string,
  userId: string
): Promise<ConsultationRound[]> {
  return listMeetingsForConsultationGroup(roundId, userId);
}

export async function listInsightsForMeeting(
  meetingId: string,
  userId: string,
  options: { accepted?: boolean } = {}
): Promise<Insight[]> {
  await requireOwnedMeeting(meetingId, userId);

  const conditions = [eq(insights.meetingId, meetingId)];

  if (options.accepted !== undefined) {
    conditions.push(eq(insights.accepted, options.accepted));
  }

  const rows = await db
    .select()
    .from(insights)
    .where(and(...conditions))
    .orderBy(desc(insights.createdAt));

  return rows.map(mapInsightRecord);
}

export async function listPeopleForUser(userId: string): Promise<Person[]> {
  const rows = await db
    .select()
    .from(people)
    .where(eq(people.userId, userId))
    .orderBy(desc(people.createdAt));

  return rows.map(mapPersonRecord);
}

export async function getPersonForUser(
  personId: string,
  userId: string
): Promise<Person | null> {
  const [row] = await db
    .select()
    .from(people)
    .where(and(eq(people.id, personId), eq(people.userId, userId)))
    .limit(1);

  return row ? mapPersonRecord(row) : null;
}

export async function listInsightsForConsultation(
  consultationId: string,
  userId: string,
  options: { accepted?: boolean } = {}
): Promise<Insight[]> {
  return listInsightsForMeeting(consultationId, userId, options);
}

export async function listInsightsForMeetings(
  meetingIds: string[],
  userId: string,
  options: { accepted?: boolean } = {}
): Promise<Insight[]> {
  const ids = uniqueIds(meetingIds);
  if (ids.length === 0) {
    return [];
  }

  const conditions = [
    eq(meetings.userId, userId),
    inArray(insights.meetingId, ids),
  ];

  if (options.accepted !== undefined) {
    conditions.push(eq(insights.accepted, options.accepted));
  }

  const rows = await db
    .select({ insight: insights })
    .from(insights)
    .innerJoin(meetings, eq(insights.meetingId, meetings.id))
    .where(and(...conditions))
    .orderBy(desc(insights.createdAt));

  return rows.map(({ insight }) => mapInsightRecord(insight));
}

export async function listInsightsForConsultations(
  consultationIds: string[],
  userId: string,
  options: { accepted?: boolean } = {}
): Promise<Insight[]> {
  return listInsightsForMeetings(consultationIds, userId, options);
}

export async function deleteInsightsForMeeting(meetingId: string, userId: string) {
  await requireOwnedMeeting(meetingId, userId);

  await db.delete(insights).where(eq(insights.meetingId, meetingId));
}

export async function deleteInsightsForConsultation(
  consultationId: string,
  userId: string
) {
  await deleteInsightsForMeeting(consultationId, userId);
}

export async function listPeopleForMeeting(
  meetingId: string,
  userId: string
): Promise<Person[]> {
  await requireOwnedMeeting(meetingId, userId);

  const rows = await db
    .select({ person: people })
    .from(consultationPeople)
    .innerJoin(people, eq(consultationPeople.personId, people.id))
    .where(eq(consultationPeople.meetingId, meetingId))
    .orderBy(desc(people.createdAt));

  return rows.map(({ person }) => mapPersonRecord(person));
}

export async function listPeopleForConsultation(
  consultationId: string,
  userId: string
): Promise<Person[]> {
  return listPeopleForMeeting(consultationId, userId);
}

export async function listMeetingPersonLinks(
  meetingId: string,
  userId: string
): Promise<Array<{ meeting_id: string; person_id: string }>> {
  await requireOwnedMeeting(meetingId, userId);

  const rows = await db
    .select({
      meetingId: consultationPeople.meetingId,
      personId: consultationPeople.personId,
    })
    .from(consultationPeople)
    .where(eq(consultationPeople.meetingId, meetingId));

  return rows.map((row) => ({
    meeting_id: row.meetingId,
    person_id: row.personId,
  }));
}

export async function listConsultationPersonLinks(
  consultationId: string,
  userId: string
): Promise<Array<{ consultation_id: string; person_id: string }>> {
  const rows = await listMeetingPersonLinks(consultationId, userId);

  return rows.map((row) => ({
    consultation_id: row.meeting_id,
    person_id: row.person_id,
  }));
}

export async function listConsultationsForPerson(
  personId: string,
  userId: string
): Promise<ConsultationRound[]> {
  await requireOwnedPerson(personId, userId);

  const rows = await db
    .select({ consultation: meetings })
    .from(consultationPeople)
    .innerJoin(
      meetings,
      eq(consultationPeople.meetingId, meetings.id)
    )
    .where(
      and(
        eq(consultationPeople.personId, personId),
        eq(meetings.userId, userId)
      )
    )
    .orderBy(desc(meetings.createdAt));

  return rows.map(({ consultation }) => mapConsultationRoundRecord(consultation));
}

export async function listConsultationIdsForPerson(
  personId: string,
  userId: string
): Promise<string[]> {
  const consultationsForPerson = await listConsultationsForPerson(personId, userId);
  return consultationsForPerson.map((consultation) => consultation.id);
}

export async function countPeopleByConsultationIds(
  consultationIds: string[],
  userId: string
): Promise<Record<string, number>> {
  const ids = uniqueIds(consultationIds);
  if (ids.length === 0) {
    return {};
  }

  const rows = await db
    .select({
      consultationId: consultationPeople.meetingId,
    })
    .from(consultationPeople)
    .innerJoin(
      meetings,
      eq(consultationPeople.meetingId, meetings.id)
    )
    .where(
      and(
        eq(meetings.userId, userId),
        inArray(consultationPeople.meetingId, ids)
      )
    );

  return rows.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.consultationId] = (accumulator[row.consultationId] ?? 0) + 1;
    return accumulator;
  }, {});
}

export async function countConsultationsByPersonIds(
  personIds: string[],
  userId: string
): Promise<Record<string, number>> {
  const ids = uniqueIds(personIds);
  if (ids.length === 0) {
    return {};
  }

  const rows = await db
    .select({
      personId: consultationPeople.personId,
    })
    .from(consultationPeople)
    .innerJoin(people, eq(consultationPeople.personId, people.id))
    .where(
      and(eq(people.userId, userId), inArray(consultationPeople.personId, ids))
    );

  return rows.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.personId] = (accumulator[row.personId] ?? 0) + 1;
    return accumulator;
  }, {});
}

export async function countConsultationsByRoundIds(
  roundIds: string[],
  userId: string
): Promise<Record<string, number>> {
  const ids = uniqueIds(roundIds);
  if (ids.length === 0) {
    return {};
  }

  const rows = await db
    .select({
      roundId: meetings.consultationId,
    })
    .from(meetings)
    .where(
      and(
        eq(meetings.userId, userId),
        inArray(meetings.consultationId, ids)
      )
    );

  return rows.reduce<Record<string, number>>((accumulator, row) => {
    if (!row.roundId) {
      return accumulator;
    }

    accumulator[row.roundId] = (accumulator[row.roundId] ?? 0) + 1;
    return accumulator;
  }, {});
}

export async function listEvidenceEmailsForConsultation(
  consultationId: string,
  userId: string
): Promise<EvidenceEmail[]> {
  return listEvidenceEmailsForMeeting(consultationId, userId);
}

export async function listEvidenceEmailsForMeeting(
  meetingId: string,
  userId: string
): Promise<EvidenceEmail[]> {
  await requireOwnedMeeting(meetingId, userId);

  const rows = await db
    .select()
    .from(evidenceEmails)
    .where(eq(evidenceEmails.meetingId, meetingId))
    .orderBy(desc(evidenceEmails.createdAt));

  return rows.map(mapEvidenceEmailRecord);
}

export async function getLatestEvidenceEmailForConsultation(
  consultationId: string,
  userId: string
): Promise<EvidenceEmail | null> {
  const [latest] = await listEvidenceEmailsForConsultation(consultationId, userId);
  return latest ?? null;
}

export async function getLatestEvidenceEmailForMeeting(
  meetingId: string,
  userId: string
): Promise<EvidenceEmail | null> {
  const [latest] = await listEvidenceEmailsForMeeting(meetingId, userId);
  return latest ?? null;
}

export async function listEvidenceEmailsForConsultations(
  consultationIds: string[],
  userId: string
): Promise<EvidenceEmail[]> {
  return listEvidenceEmailsForMeetings(consultationIds, userId);
}

export async function listEvidenceEmailsForMeetings(
  meetingIds: string[],
  userId: string
): Promise<EvidenceEmail[]> {
  const ids = uniqueIds(meetingIds);
  if (ids.length === 0) {
    return [];
  }

  const rows = await db
    .select({ email: evidenceEmails })
    .from(evidenceEmails)
    .innerJoin(
      meetings,
      eq(evidenceEmails.meetingId, meetings.id)
    )
    .where(
      and(
        eq(meetings.userId, userId),
        inArray(evidenceEmails.meetingId, ids)
      )
    )
    .orderBy(asc(evidenceEmails.createdAt));

  return rows.map(({ email }) => mapEvidenceEmailRecord(email));
}

export async function listAuditEventsForUser(
  userId: string,
  filters: AuditEventFilters = {}
): Promise<AuditLogEntry[]> {
  const conditions = [eq(auditLog.userId, userId)];

  if (filters.actorUserId) {
    conditions.push(eq(auditLog.userId, filters.actorUserId));
  }

  if (filters.consultationId) {
    conditions.push(eq(auditLog.meetingId, filters.consultationId));
  }

  const consultationIds = uniqueIds(filters.consultationIds ?? []);
  if (consultationIds.length > 0) {
    conditions.push(inArray(auditLog.meetingId, consultationIds));
  }

  if (filters.action) {
    conditions.push(eq(auditLog.action, filters.action));
  }

  if (filters.dateFromIso) {
    conditions.push(gte(auditLog.createdAt, new Date(filters.dateFromIso)));
  }

  if (filters.dateToIso) {
    conditions.push(lt(auditLog.createdAt, new Date(filters.dateToIso)));
  }

  const rows = await db
    .select()
    .from(auditLog)
    .where(and(...conditions))
    .orderBy(
      filters.ascending ? asc(auditLog.createdAt) : desc(auditLog.createdAt)
    );

  return rows.map(mapAuditLogRecord);
}

export async function listAuditEventsForConsultation(
  consultationId: string,
  userId: string
): Promise<AuditLogEntry[]> {
  await requireOwnedMeeting(consultationId, userId);

  return listAuditEventsForUser(userId, { consultationId });
}

export async function listAuditEventsForMeeting(
  meetingId: string,
  userId: string
): Promise<AuditLogEntry[]> {
  await requireOwnedMeeting(meetingId, userId);

  return listAuditEventsForUser(userId, { consultationId: meetingId });
}

export async function listAuditEventsForRound(
  roundId: string,
  userId: string
): Promise<AuditLogEntry[]> {
  await requireOwnedRound(roundId, userId);

  const rows = await db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.userId, userId),
        or(
          and(
            eq(auditLog.entityType, "consultation_round"),
            eq(auditLog.entityId, roundId)
          ),
          sql`coalesce(${auditLog.payload} ->> 'round_id', ${auditLog.payload} ->> 'roundId') = ${roundId}`
        )
      )
    )
    .orderBy(desc(auditLog.createdAt));

  return rows.map(mapAuditLogRecord);
}

export async function listAuditUserIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({
      userId: auditLog.userId,
    })
    .from(auditLog)
    .where(eq(auditLog.userId, userId))
    .orderBy(desc(auditLog.createdAt))
    .limit(1000);

  return uniqueIds(rows.map((row) => row.userId));
}

export async function listRoundOutputArtifactsForUser(
  userId: string
): Promise<RoundOutputArtifact[]> {
  const rows = await db
    .select()
    .from(roundOutputArtifacts)
    .where(eq(roundOutputArtifacts.userId, userId))
    .orderBy(desc(roundOutputArtifacts.generatedAt));

  return rows.map(mapRoundOutputArtifactRecord);
}

export async function getRoundOutputArtifactForUser(
  artifactId: string,
  userId: string
): Promise<RoundOutputArtifact | null> {
  const [row] = await db
    .select()
    .from(roundOutputArtifacts)
    .where(
      and(
        eq(roundOutputArtifacts.id, artifactId),
        eq(roundOutputArtifacts.userId, userId)
      )
    )
    .limit(1);

  return row ? mapRoundOutputArtifactRecord(row) : null;
}

export async function listRoundOutputArtifactsForRound(
  roundId: string,
  userId: string,
  artifactType?: string
): Promise<RoundOutputArtifact[]> {
  await requireOwnedRound(roundId, userId);

  const conditions = [
    eq(roundOutputArtifacts.consultationId, roundId),
    eq(roundOutputArtifacts.userId, userId),
  ];

  if (artifactType) {
    conditions.push(eq(roundOutputArtifacts.artifactType, artifactType));
  }

  const rows = await db
    .select()
    .from(roundOutputArtifacts)
    .where(and(...conditions))
    .orderBy(desc(roundOutputArtifacts.generatedAt));

  return rows.map(mapRoundOutputArtifactRecord);
}

export interface DashboardStats {
  totalConsultations: number;
  totalPeople: number;
  emailsSent: number;
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const [consultationCountResult, peopleCountResult, emailsSentResult] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(consultations)
      .where(eq(consultations.userId, userId)),
    db
      .select({ count: sql<number>`count(distinct ${consultationPeople.personId})::int` })
      .from(consultationPeople)
      .innerJoin(meetings, eq(consultationPeople.meetingId, meetings.id))
      .where(eq(meetings.userId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(evidenceEmails)
      .innerJoin(meetings, eq(evidenceEmails.meetingId, meetings.id))
      .where(and(eq(meetings.userId, userId), eq(evidenceEmails.status, "sent"))),
  ]);

  return {
    totalConsultations: consultationCountResult[0]?.count ?? 0,
    totalPeople: peopleCountResult[0]?.count ?? 0,
    emailsSent: emailsSentResult[0]?.count ?? 0,
  };
}

export async function listDraftThemesForRound(
  roundId: string,
  userId: string
): Promise<Theme[]> {
  await requireOwnedRound(roundId, userId);

  const rows = await db
    .select()
    .from(themes)
    .where(
      and(
        eq(themes.consultationId, roundId),
        eq(themes.userId, userId),
        eq(themes.status, "draft")
      )
    )
    .orderBy(asc(themes.createdAt));

  return rows.map(mapThemeRecord);
}
