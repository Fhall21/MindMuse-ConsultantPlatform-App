import { NextRequest, NextResponse } from "next/server";
import {
  enforceUploadSizeLimit,
  forwardFormDataToAi,
  getAiServiceUrlOrResponse,
  parseFormDataOrResponse,
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

  const formData = await parseFormDataOrResponse(request);
  if (formData instanceof NextResponse) {
    return formData;
  }

  const uploadTooLarge = enforceUploadSizeLimit(formData);
  if (uploadTooLarge) {
    return uploadTooLarge;
  }

  return forwardFormDataToAi(aiServiceUrl, "/transcribe/audio", formData);
}
