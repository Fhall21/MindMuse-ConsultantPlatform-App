import { NextRequest, NextResponse } from "next/server";
import {
  getAiServiceUrlOrResponse,
  requireAuthenticatedApiUser,
} from "@/lib/api/route-helpers";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) return auth;

  const aiServiceUrl = getAiServiceUrlOrResponse();
  if (aiServiceUrl instanceof NextResponse) return aiServiceUrl;

  const { path = [] } = await params;
  const upstreamPath = `/research/${path.map(encodeURIComponent).join("/")}`;
  const contentType = request.headers.get("content-type");

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(`${aiServiceUrl}${upstreamPath}`, {
      method: "POST",
      headers: contentType ? { "Content-Type": contentType } : undefined,
      body: await request.arrayBuffer(),
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

  if (!upstreamResponse.body) {
    return NextResponse.json(
      { detail: "AI service returned an empty stream" },
      { status: upstreamResponse.ok ? 502 : upstreamResponse.status }
    );
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: {
      "Content-Type":
        upstreamResponse.headers.get("content-type") ?? "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
