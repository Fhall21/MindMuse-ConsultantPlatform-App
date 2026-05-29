import { NextResponse } from "next/server";
import { z } from "zod";
import { getAiServiceUrlOrResponse } from "@/lib/api/route-helpers";
import { requireOwnedRound } from "@/lib/data/ownership";
import { jsonError, requireRouteClient } from "../../../../_helpers";

const nodeSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
});

const requestSchema = z.object({
  nodes: z.array(nodeSchema),
});

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

  const aiServiceUrl = getAiServiceUrlOrResponse();
  if (aiServiceUrl instanceof NextResponse) return aiServiceUrl;

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(`${aiServiceUrl}/canvas/spatial-layout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundId, nodes: parsed.data.nodes }),
    });
  } catch (error) {
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
    return NextResponse.json(
      { detail: text || "AI service returned an invalid response" },
      { status: upstreamResponse.ok ? 502 : upstreamResponse.status }
    );
  }

  return NextResponse.json(await upstreamResponse.json(), {
    status: upstreamResponse.status,
  });
}
