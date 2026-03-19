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
  consultationPeople,
  consultationRounds,
  consultations,
  evidenceEmails,
  people,
  roundOutputArtifacts,
  themes,
} from "@/db/schema";
import type {
  AuditLogEntry,
  Consultation,
  ConsultationRound,
  EvidenceEmail,
  Person,
  RoundOutputArtifact,
  Theme,
} from "@/types/db";
import {
  mapAuditLogRecord,
  mapConsultationRecord,
  mapConsultationRoundRecord,
  mapEvidenceEmailRecord,
  mapPersonRecord,
  mapRoundOutputArtifactRecord,
  mapThemeRecord,
} from "./mappers";
import {
  requireOwnedConsultation,
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

export async function listConsultationsForRound(
  roundId: string,
  userId: string
): Promise<Consultation[]> {
  await requireOwnedRound(roundId, userId);

  const rows = await db
    .select()
    .from(consultations)
    .where(
      and(
        eq(consultations.roundId, roundId),
        eq(consultations.userId, userId)
      )
    )
    .orderBy(asc(consultations.createdAt));

  return rows.map(mapConsultationRecord);
}

export async function listRoundsForUser(
  userId: string
): Promise<ConsultationRound[]> {
  const rows = await db
    .select()
    .from(consultationRounds)
    .where(eq(consultationRounds.userId, userId))
    .orderBy(desc(consultationRounds.createdAt));

  return rows.map(mapConsultationRoundRecord);
}

export async function getRoundForUser(
  roundId: string,
  userId: string
): Promise<ConsultationRound | null> {
  const [row] = await db
    .select()
    .from(consultationRounds)
    .where(
      and(
        eq(consultationRounds.id, roundId),
        eq(consultationRounds.userId, userId)
      )
    )
    .limit(1);

  return row ? mapConsultationRoundRecord(row) : null;
}

export async function listRoundsByIdsForUser(
  roundIds: string[],
  userId: string
): Promise<ConsultationRound[]> {
  const ids = uniqueIds(roundIds);
  if (ids.length === 0) {
    return [];
  }

  const rows = await db
    .select()
    .from(consultationRounds)
    .where(
      and(
        eq(consultationRounds.userId, userId),
        inArray(consultationRounds.id, ids)
      )
    );

  return rows.map(mapConsultationRoundRecord);
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

export async function listThemesForConsultation(
  consultationId: string,
  userId: string,
  options: { accepted?: boolean } = {}
): Promise<Theme[]> {
  await requireOwnedConsultation(consultationId, userId);

  const conditions = [eq(themes.consultationId, consultationId)];

  if (options.accepted !== undefined) {
    conditions.push(eq(themes.accepted, options.accepted));
  }

  const rows = await db
    .select()
    .from(themes)
    .where(and(...conditions))
    .orderBy(desc(themes.createdAt));

  return rows.map(mapThemeRecord);
}

export async function listThemesForConsultations(
  consultationIds: string[],
  userId: string,
  options: { accepted?: boolean } = {}
): Promise<Theme[]> {
  const ids = uniqueIds(consultationIds);
  if (ids.length === 0) {
    return [];
  }

  const conditions = [
    eq(consultations.userId, userId),
    inArray(themes.consultationId, ids),
  ];

  if (options.accepted !== undefined) {
    conditions.push(eq(themes.accepted, options.accepted));
  }

  const rows = await db
    .select({ theme: themes })
    .from(themes)
    .innerJoin(consultations, eq(themes.consultationId, consultations.id))
    .where(and(...conditions))
    .orderBy(desc(themes.createdAt));

  return rows.map(({ theme }) => mapThemeRecord(theme));
}

export async function deleteThemesForConsultation(
  consultationId: string,
  userId: string
) {
  await requireOwnedConsultation(consultationId, userId);

  await db.delete(themes).where(eq(themes.consultationId, consultationId));
}

export async function listPeopleForConsultation(
  consultationId: string,
  userId: string
): Promise<Person[]> {
  await requireOwnedConsultation(consultationId, userId);

  const rows = await db
    .select({ person: people })
    .from(consultationPeople)
    .innerJoin(people, eq(consultationPeople.personId, people.id))
    .where(eq(consultationPeople.consultationId, consultationId))
    .orderBy(desc(people.createdAt));

  return rows.map(({ person }) => mapPersonRecord(person));
}

export async function listConsultationPersonLinks(
  consultationId: string,
  userId: string
): Promise<Array<{ consultation_id: string; person_id: string }>> {
  await requireOwnedConsultation(consultationId, userId);

  const rows = await db
    .select({
      consultationId: consultationPeople.consultationId,
      personId: consultationPeople.personId,
    })
    .from(consultationPeople)
    .where(eq(consultationPeople.consultationId, consultationId));

  return rows.map((row) => ({
    consultation_id: row.consultationId,
    person_id: row.personId,
  }));
}

export async function listConsultationsForPerson(
  personId: string,
  userId: string
): Promise<Consultation[]> {
  await requireOwnedPerson(personId, userId);

  const rows = await db
    .select({ consultation: consultations })
    .from(consultationPeople)
    .innerJoin(
      consultations,
      eq(consultationPeople.consultationId, consultations.id)
    )
    .where(
      and(
        eq(consultationPeople.personId, personId),
        eq(consultations.userId, userId)
      )
    )
    .orderBy(desc(consultations.createdAt));

  return rows.map(({ consultation }) => mapConsultationRecord(consultation));
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
      consultationId: consultationPeople.consultationId,
    })
    .from(consultationPeople)
    .innerJoin(
      consultations,
      eq(consultationPeople.consultationId, consultations.id)
    )
    .where(
      and(
        eq(consultations.userId, userId),
        inArray(consultationPeople.consultationId, ids)
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
      roundId: consultations.roundId,
    })
    .from(consultations)
    .where(
      and(
        eq(consultations.userId, userId),
        inArray(consultations.roundId, ids)
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
  await requireOwnedConsultation(consultationId, userId);

  const rows = await db
    .select()
    .from(evidenceEmails)
    .where(eq(evidenceEmails.consultationId, consultationId))
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

export async function listEvidenceEmailsForConsultations(
  consultationIds: string[],
  userId: string
): Promise<EvidenceEmail[]> {
  const ids = uniqueIds(consultationIds);
  if (ids.length === 0) {
    return [];
  }

  const rows = await db
    .select({ email: evidenceEmails })
    .from(evidenceEmails)
    .innerJoin(
      consultations,
      eq(evidenceEmails.consultationId, consultations.id)
    )
    .where(
      and(
        eq(consultations.userId, userId),
        inArray(evidenceEmails.consultationId, ids)
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
    conditions.push(eq(auditLog.consultationId, filters.consultationId));
  }

  const consultationIds = uniqueIds(filters.consultationIds ?? []);
  if (consultationIds.length > 0) {
    conditions.push(inArray(auditLog.consultationId, consultationIds));
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
  await requireOwnedConsultation(consultationId, userId);

  return listAuditEventsForUser(userId, { consultationId });
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
    eq(roundOutputArtifacts.roundId, roundId),
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
