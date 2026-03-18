import { NextRequest, NextResponse } from "next/server";
import {
  forwardJsonToAi,
  getAiServiceUrlOrResponse,
  parseJsonBodyOrResponse,
  requireAuthenticatedApiUser,
} from "@/lib/api/route-helpers";

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const aiServiceUrl = getAiServiceUrlOrResponse();
  if (aiServiceUrl instanceof NextResponse) {
    return aiServiceUrl;
  }

  const body = await parseJsonBodyOrResponse(request);
  if (body instanceof NextResponse) {
    return body;
  }

  return forwardJsonToAi(aiServiceUrl, "/clarification/questions", body);
}
