import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getAiServiceUrlOrResponse } from "@/lib/api/route-helpers";
import { requireOwnedRound } from "@/lib/data/ownership";
import { db } from "@/db/client";
import { canvasSpatialLayoutJobs } from "@/db/schema/domain";
import { jsonError, requireRouteClient } from "../../../../_helpers";

const nodeSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
});

const requestSchema = z.object({
  nodes: z.array(nodeSchema),
});

const STALE_THRESHOLD_MS = 90_000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    await requireOwnedRound(roundId, client.userId);
  } catch {
    return jsonError("Round not found", 403);
  }

  const [job] = await db
    .select()
    .from(canvasSpatialLayoutJobs)
    .where(
      and(
        eq(canvasSpatialLayoutJobs.consultationId, roundId),
        eq(canvasSpatialLayoutJobs.userId, client.userId),
        inArray(canvasSpatialLayoutJobs.status, ["running", "completed", "failed"])
      )
    )
    .orderBy(desc(canvasSpatialLayoutJobs.createdAt))
    .limit(1);

  if (!job) {
    return NextResponse.json({ status: "idle" });
  }

  if (job.status === "running") {
    const ageMs = job.startedAt
      ? Date.now() - new Date(job.startedAt).getTime()
      : STALE_THRESHOLD_MS + 1;

    if (ageMs > STALE_THRESHOLD_MS) {
      // D3: try/catch — always return failed even if DB update throws
      try {
        await db
          .update(canvasSpatialLayoutJobs)
          .set({ status: "failed", errorMessage: "timed out", updatedAt: new Date() })
          .where(eq(canvasSpatialLayoutJobs.id, job.id));
      } catch {
        // intentionally ignored — we still return failed to the client
      }
      return NextResponse.json({ status: "failed" });
    }

    return NextResponse.json({ status: "running" });
  }

  if (job.status === "completed") {
    return NextResponse.json({
      status: "completed",
      resultPositions: job.resultPositions ?? {},
    });
  }

  // failed
  return NextResponse.json({ status: "idle" });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    await requireOwnedRound(roundId, client.userId);
  } catch {
    return jsonError("Round not found", 403);
  }

  const [job] = await db
    .select()
    .from(canvasSpatialLayoutJobs)
    .where(
      and(
        eq(canvasSpatialLayoutJobs.consultationId, roundId),
        eq(canvasSpatialLayoutJobs.userId, client.userId),
        eq(canvasSpatialLayoutJobs.status, "running")
      )
    )
    .limit(1);

  if (!job) {
    return jsonError("No running layout job found", 404);
  }

  await db
    .update(canvasSpatialLayoutJobs)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(canvasSpatialLayoutJobs.id, job.id));

  return new NextResponse(null, { status: 204 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    await requireOwnedRound(roundId, client.userId);
  } catch {
    return jsonError("Round not found", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON payload", 422);
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid spatial layout request", 422);
  }
  if (parsed.data.nodes.length < 3) {
    return jsonError("At least 3 nodes required for spatial layout", 400);
  }
  if (parsed.data.nodes.length > 200) {
    return jsonError("Maximum 200 nodes allowed for spatial layout", 400);
  }

  // D2: app-level 409 guard for concurrent jobs
  const [existingJob] = await db
    .select()
    .from(canvasSpatialLayoutJobs)
    .where(
      and(
        eq(canvasSpatialLayoutJobs.consultationId, roundId),
        eq(canvasSpatialLayoutJobs.userId, client.userId),
        eq(canvasSpatialLayoutJobs.status, "running")
      )
    )
    .limit(1);

  if (existingJob) {
    return jsonError("A layout job is already running", 409);
  }

  const [newJob] = await db
    .insert(canvasSpatialLayoutJobs)
    .values({
      consultationId: roundId,
      userId: client.userId,
      status: "running",
      startedAt: new Date(),
    })
    .returning();

  const aiServiceUrl = getAiServiceUrlOrResponse();
  if (aiServiceUrl instanceof NextResponse) {
    await db
      .update(canvasSpatialLayoutJobs)
      .set({ status: "failed", errorMessage: "AI service unavailable", updatedAt: new Date() })
      .where(eq(canvasSpatialLayoutJobs.id, newJob.id));
    return aiServiceUrl;
  }

  let upstreamResponse: Response;
  try {
    // Intentionally NO request.signal — server continues after client disconnects,
    // allowing stale-detection polling to pick up results on page refresh.
    upstreamResponse = await fetch(`${aiServiceUrl}/canvas/spatial-layout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundId, nodes: parsed.data.nodes }),
    });
  } catch (error) {
    await db
      .update(canvasSpatialLayoutJobs)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Failed to reach AI service",
        updatedAt: new Date(),
      })
      .where(eq(canvasSpatialLayoutJobs.id, newJob.id));
    return NextResponse.json(
      {
        detail:
          error instanceof Error ? error.message : "Failed to reach AI service",
      },
      { status: 502 }
    );
  }

  const contentType = upstreamResponse.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await upstreamResponse.text();
    await db
      .update(canvasSpatialLayoutJobs)
      .set({
        status: "failed",
        errorMessage: text || "AI service returned an invalid response",
        updatedAt: new Date(),
      })
      .where(eq(canvasSpatialLayoutJobs.id, newJob.id));
    return NextResponse.json(
      { detail: text || "AI service returned an invalid response" },
      { status: upstreamResponse.ok ? 502 : upstreamResponse.status }
    );
  }

  const responseData = await upstreamResponse.json() as Record<string, unknown>;

  if (upstreamResponse.ok && responseData.positions) {
    await db
      .update(canvasSpatialLayoutJobs)
      .set({
        status: "completed",
        resultPositions: responseData.positions as Record<string, { x: number; y: number }>,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(canvasSpatialLayoutJobs.id, newJob.id));
  } else {
    await db
      .update(canvasSpatialLayoutJobs)
      .set({
        status: "failed",
        errorMessage: (responseData.detail as string | undefined) ?? "Layout failed",
        updatedAt: new Date(),
      })
      .where(eq(canvasSpatialLayoutJobs.id, newJob.id));
  }

  return NextResponse.json(responseData, { status: upstreamResponse.status });
}
