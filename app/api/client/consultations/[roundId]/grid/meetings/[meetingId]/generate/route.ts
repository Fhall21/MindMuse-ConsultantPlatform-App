import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  gridCellInsights,
  gridCells,
  gridColumns,
  insights,
  meetings,
  quoteInsightLinks,
  quotes,
} from "@/db/schema";
import { createChatServiceToken } from "@/lib/chat/service-token";
import { API_PROXY_SESSION_ID } from "@/lib/chat/constants";
import { getAiServiceUrl } from "@/lib/env";
import {
  computeCellConfidence,
  computeInsightConfidence,
} from "@/lib/quotes/insight-confidence";
import { computeQuoteContext } from "@/lib/quotes/transcript-context";
import { jsonError, requireRouteClient } from "../../../../../../_helpers";
import {
  gridGenerateResponseSchema,
  type GridGenerateResponse,
} from "../../../_types";

type GenerationContext = {
  meeting: typeof meetings.$inferSelect;
  cells: (typeof gridCells.$inferSelect)[];
  columns: (typeof gridColumns.$inferSelect)[];
};

async function markMeetingCellsFailed(roundId: string, meetingId: string) {
  await db
    .update(gridCells)
    .set({ status: "failed", updatedAt: new Date() })
    .where(
      and(
        eq(gridCells.meetingId, meetingId),
        eq(gridCells.consultationId, roundId),
        eq(gridCells.status, "generating")
      )
    );
}

function validateAnswerSet(
  data: GridGenerateResponse,
  cells: (typeof gridCells.$inferSelect)[]
) {
  const expected = cells.map((cell) => `${cell.columnId}:${cell.id}`);
  const actual = data.answers.map(
    (answer) => `${answer.columnId}:${answer.cellId}`
  );

  if (
    expected.length !== actual.length ||
    expected.some((key, index) => key !== actual[index])
  ) {
    throw new Error(
      "AI service response did not contain exactly one ordered answer per grid cell"
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roundId: string; meetingId: string }> }
) {
  const { roundId, meetingId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  const retry = new URL(request.url).searchParams.get("retry") === "true";

  let context: GenerationContext;
  try {
    context = await db.transaction(async (tx) => {
      const [meeting] = await tx
        .select()
        .from(meetings)
        .where(
          and(
            eq(meetings.id, meetingId),
            eq(meetings.consultationId, roundId),
            eq(meetings.userId, client.userId)
          )
        )
        .limit(1)
        .for("update");

      if (!meeting) {
        throw new Error("Meeting not found");
      }

      const cells = await tx
        .select()
        .from(gridCells)
        .where(
          and(
            eq(gridCells.meetingId, meetingId),
            eq(gridCells.consultationId, roundId)
          )
        )
        .orderBy(gridCells.columnId)
        .for("update");

      if (!retry && cells.some((cell) => cell.status === "generating")) {
        throw new Error("Generation already in progress");
      }
      if (
        !retry &&
        cells.length > 0 &&
        cells.every(
          (cell) =>
            cell.status === "complete" || cell.status === "no_evidence"
        )
      ) {
        throw new Error("All cells are already complete");
      }

      const cellIds = cells.map((cell) => cell.id);
      if (retry && cellIds.length > 0) {
        await tx
          .delete(gridCellInsights)
          .where(
            and(
              inArray(gridCellInsights.gridCellId, cellIds),
              eq(gridCellInsights.accepted, false),
              eq(gridCellInsights.rejected, false)
            )
          );

        await tx
          .update(gridCells)
          .set({
            status: "pending",
            confidence: null,
            updatedAt: new Date(),
          })
          .where(inArray(gridCells.id, cellIds));
      }

      if (cellIds.length > 0) {
        await tx
          .update(gridCells)
          .set({ status: "generating", updatedAt: new Date() })
          .where(inArray(gridCells.id, cellIds));
      }

      const columns = await tx
        .select()
        .from(gridColumns)
        .where(eq(gridColumns.consultationId, roundId))
        .orderBy(gridColumns.position);

      const columnById = new Map(columns.map((column) => [column.id, column]));
      const orderedCells = cells
        .filter((cell) => columnById.has(cell.columnId))
        .sort(
          (left, right) =>
            (columnById.get(left.columnId)?.position ?? 0) -
            (columnById.get(right.columnId)?.position ?? 0)
        );

      return { meeting, cells: orderedCells, columns };
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to initialize generation";
    const status =
      message === "Meeting not found"
        ? 404
        : message === "Generation already in progress" ||
            message === "All cells are already complete"
          ? 409
          : 500;
    return jsonError(message, status);
  }

  if (context.cells.length === 0) {
    return NextResponse.json({ meetingId, cells: [] });
  }

  const columnById = new Map(
    context.columns.map((column) => [column.id, column])
  );
  const payload = {
    meetingId,
    transcriptRaw: context.meeting.transcriptRaw ?? "",
    columnQuestions: context.cells.map((cell) => ({
      columnId: cell.columnId,
      question: columnById.get(cell.columnId)?.question ?? "",
      cellId: cell.id,
    })),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45_000);
  let response: Response;

  try {
    const token = createChatServiceToken({
      userId: client.userId,
      sessionId: API_PROXY_SESSION_ID,
    });
    response = await fetch(`${getAiServiceUrl()}/grid/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    await markMeetingCellsFailed(roundId, meetingId);
    const timedOut =
      error instanceof DOMException && error.name === "AbortError";
    return jsonError(
      timedOut ? "AI service request timed out" : "AI service request failed",
      timedOut ? 408 : 500
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    await markMeetingCellsFailed(roundId, meetingId);
    return jsonError("AI service generation failed", 500);
  }

  let data: GridGenerateResponse;
  try {
    data = gridGenerateResponseSchema.parse(await response.json());
    validateAnswerSet(data, context.cells);
  } catch {
    await markMeetingCellsFailed(roundId, meetingId);
    return jsonError("AI service returned an invalid response", 500);
  }

  try {
    await db.transaction(async (tx) => {
      for (const answer of data.answers) {
        const cell = context.cells.find(
          (candidate) => candidate.id === answer.cellId
        );
        if (!cell || cell.columnId !== answer.columnId) {
          throw new Error(`Cell column mismatch for cell ${answer.cellId}`);
        }

        if (answer.hasEvidence) {
          for (const generatedInsight of answer.insights) {
            let insightId: string | null = null;
            let createdInsight = false;

            if (generatedInsight.existingInsightId) {
              const [existing] = await tx
                .select({ id: insights.id })
                .from(insights)
                .where(
                  and(
                    eq(insights.id, generatedInsight.existingInsightId),
                    eq(insights.meetingId, meetingId)
                  )
                )
                .limit(1);
              insightId = existing?.id ?? null;
            }

            if (!insightId) {
              const [created] = await tx
                .insert(insights)
                .values({
                  meetingId,
                  label: generatedInsight.title,
                  description: generatedInsight.description,
                  accepted: false,
                  rejected: false,
                  isUserAdded: false,
                  weight: "1.0",
                })
                .returning({ id: insights.id });
              insightId = created.id;
              createdInsight = true;
            }

            if (cell.columnId !== answer.columnId) {
              throw new Error(`Grid column mismatch for cell ${cell.id}`);
            }

            await tx
              .insert(gridCellInsights)
              .values({
                insightId,
                gridCellId: cell.id,
                gridColumnId: cell.columnId,
                gridReviewState: "pending",
                accepted: false,
                rejected: false,
              })
              .onConflictDoNothing();

            if (createdInsight) {
              for (const [index, generatedQuote] of generatedInsight.quotes.entries()) {
                const quoteContext = computeQuoteContext(
                  context.meeting.transcriptRaw ?? "",
                  generatedQuote.spanStart,
                  generatedQuote.spanEnd,
                  "compact"
                );

                const [createdQuote] = await tx
                  .insert(quotes)
                  .values({
                    meetingId,
                    userId: client.userId,
                    spanStart: generatedQuote.spanStart,
                    spanEnd: generatedQuote.spanEnd,
                    exactText: generatedQuote.exactText,
                    speakerLabel: generatedQuote.speakerLabel ?? null,
                    workGroupLabel: null,
                    personId: null,
                    status: "suggested",
                    source: "ai",
                    anonymousMaskRule: "role_workgroup",
                    riskFlag: false,
                    contextBefore: quoteContext.contextBefore,
                    contextAfter: quoteContext.contextAfter,
                  })
                  .returning({ id: quotes.id });

                await tx.insert(quoteInsightLinks).values({
                  quoteId: createdQuote.id,
                  insightId,
                  isPrimary: index === 0,
                  linkType: "provisional",
                  relevanceStrength: generatedQuote.relevanceStrength,
                });
              }
            }
          }
        }

        const cellJunctions = await tx
          .select({ insightId: gridCellInsights.insightId })
          .from(gridCellInsights)
          .where(eq(gridCellInsights.gridCellId, cell.id));
        const insightIds = cellJunctions.map((junction) => junction.insightId);
        const cellQuoteLinks =
          insightIds.length === 0
            ? []
            : await tx
                .select({
                  insightId: quoteInsightLinks.insightId,
                  quoteId: quoteInsightLinks.quoteId,
                  relevanceStrength: quoteInsightLinks.relevanceStrength,
                })
                .from(quoteInsightLinks)
                .where(inArray(quoteInsightLinks.insightId, insightIds));

        const insightConfidences = insightIds.map((insightId) =>
          computeInsightConfidence(
            cellQuoteLinks
              .filter((link) => link.insightId === insightId)
              .map((link) => ({ relevanceStrength: link.relevanceStrength }))
          )
        );
        const cellConfidence = computeCellConfidence(
          insightConfidences,
          answer.confidence
        );

        const insightCount = cellJunctions.length;
        await tx
          .update(gridCells)
          .set({
            status: insightCount > 0 ? "complete" : "no_evidence",
            confidence: insightCount > 0 ? cellConfidence : null,
            insightCount,
            quoteCount: cellQuoteLinks.length,
            generatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(gridCells.id, cell.id));
      }
    });
  } catch (error) {
    await markMeetingCellsFailed(roundId, meetingId);
    console.error("[grid/meeting-generate] Failed to persist generation", error);
    return jsonError("Failed to persist generated grid insights", 500);
  }

  const finalCells = await db
    .select({
      cellId: gridCells.id,
      status: gridCells.status,
      insightCount: gridCells.insightCount,
    })
    .from(gridCells)
    .where(
      and(
        eq(gridCells.meetingId, meetingId),
        eq(gridCells.consultationId, roundId)
      )
    );

  return NextResponse.json({
    meetingId,
    cells: finalCells.map((cell) => ({
      ...cell,
      status: cell.status ?? "pending",
      insightCount: cell.insightCount ?? 0,
    })),
  });
}
