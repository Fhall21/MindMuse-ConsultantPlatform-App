import { NextRequest, NextResponse } from "next/server";
import {
  getAiServiceUrlOrResponse,
  requireAuthenticatedApiUser,
} from "@/lib/api/route-helpers";

type RouteContext = {
  params: Promise<{ entryId: string }>;
};

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) return auth;

  const aiServiceUrl = getAiServiceUrlOrResponse();
  if (aiServiceUrl instanceof NextResponse) return aiServiceUrl;

  const { entryId } = await params;
  if (!entryId) {
    return NextResponse.json({ detail: "entryId required" }, { status: 422 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `${aiServiceUrl}/research/analysis/artifacts/${encodeURIComponent(entryId)}`,
      { method: "GET" }
    );
  } catch (error) {
    return NextResponse.json(
      {
        detail:
          error instanceof Error ? error.message : "Failed to reach AI service",
      },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { detail: `AI service returned ${upstream.status}` },
      { status: upstream.status }
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  const disposition =
    upstream.headers.get("content-disposition") ??
    `attachment; filename="${entryId}.bin"`;

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=300",
    },
  });
}
