"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  consultations as consultationGroups,
  meetings as consultationRounds,
  consultations,
  meetings,
  insights,
  people,
} from "@/db/schema";

export async function requireOwnedConsultation(
  consultationId: string,
  userId: string
) {
  const [consultation] = await db
    .select()
    .from(consultations)
    .where(
      and(
        eq(consultations.id, consultationId),
        eq(consultations.userId, userId)
      )
    )
    .limit(1);

  if (!consultation) {
    throw new Error("Consultation not found");
  }

  return consultation;
}

export async function requireOwnedMeeting(meetingId: string, userId: string) {
  const [meeting] = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)))
    .limit(1);

  if (!meeting) {
    throw new Error("Meeting not found");
  }

  return meeting;
}

export async function requireOwnedTheme(themeId: string, meetingId: string, userId: string) {
  const meeting = await requireOwnedMeeting(meetingId, userId);

  const [theme] = await db
    .select()
    .from(insights)
    .where(
      and(
        eq(insights.id, themeId),
        eq(insights.meetingId, meeting.id)
      )
    )
    .limit(1);

  if (!theme) {
    throw new Error("Theme not found");
  }

  return { meeting, theme };
}

export async function requireOwnedRound(roundId: string, userId: string) {
  const [round] = await db
    .select()
    .from(consultationRounds)
    .where(
      and(eq(consultationRounds.id, roundId), eq(consultationRounds.userId, userId))
    )
    .limit(1);

  if (!round) {
    throw new Error("Round not found");
  }

  return round;
}

export async function requireOwnedPerson(personId: string, userId: string) {
  const [person] = await db
    .select()
    .from(people)
    .where(and(eq(people.id, personId), eq(people.userId, userId)))
    .limit(1);

  if (!person) {
    throw new Error("Person not found");
  }

  return person;
}

export async function requireOwnedConsultationGroup(groupId: string, userId: string) {
  const [group] = await db
    .select()
    .from(consultationGroups)
    .where(
      and(eq(consultationGroups.id, groupId), eq(consultationGroups.userId, userId))
    )
    .limit(1);

  if (!group) {
    throw new Error("Consultation group not found");
  }

  return group;
}
