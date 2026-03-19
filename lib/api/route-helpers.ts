import { NextRequest, NextResponse } from "next/server";
import { getAiServiceUrl } from "@/lib/env";
import { getCurrentUserId } from "@/lib/data/auth-context";

const AI_PROXY_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function sanitizeUpstreamError(err: unknown): string {
  if (err instanceof DOMException && err.name === "AbortError") {
    return "AI service request timed out";
  }

  if (err instanceof Error) {
    return err.message;
  }

  return "Failed to reach AI service";
}

export async function requireAuthenticatedApiUser(): Promise<NextResponse | { id: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  return { id: userId };
}

export function getAiServiceUrlOrResponse(): string | NextResponse {
  try {
    return getAiServiceUrl();
  } catch {
    return NextResponse.json({ detail: "AI service is not configured" }, { status: 503 });
  }
}

export async function parseJsonBodyOrResponse(
  request: NextRequest
): Promise<unknown | NextResponse> {
  try {
    return await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON payload" }, { status: 422 });
  }
}

export async function parseFormDataOrResponse(
  request: NextRequest
): Promise<FormData | NextResponse> {
  try {
    return await request.formData();
  } catch {
    return NextResponse.json(
      { detail: "Request body must be multipart/form-data" },
      { status: 422 }
    );
  }
}

export function enforceUploadSizeLimit(
  formData: FormData,
  maxBytes = DEFAULT_MAX_UPLOAD_BYTES
): NextResponse | null {
  for (const value of formData.values()) {
    if (value instanceof File && value.size > maxBytes) {
      return NextResponse.json({ detail: "Uploaded file is too large" }, { status: 413 });
    }
  }

  return null;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = AI_PROXY_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function forwardJsonToAi(
  aiServiceUrl: string,
  path: string,
  payload: unknown
): Promise<NextResponse> {
  let response: Response;

  try {
    response = await fetchWithTimeout(`${aiServiceUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return NextResponse.json({ detail: sanitizeUpstreamError(err) }, { status: 502 });
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await response.text();
    return NextResponse.json(
      { detail: text || "AI service returned an invalid response" },
      { status: response.ok ? 502 : response.status }
    );
  }

  const data = await response.json();
  return NextResponse.json(data, { status: response.ok ? 200 : response.status });
}

export async function forwardFormDataToAi(
  aiServiceUrl: string,
  path: string,
  formData: FormData
): Promise<NextResponse> {
  let response: Response;

  try {
    response = await fetchWithTimeout(`${aiServiceUrl}${path}`, {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    return NextResponse.json({ detail: sanitizeUpstreamError(err) }, { status: 502 });
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await response.text();
    return NextResponse.json(
      { detail: text || "AI service returned an invalid response" },
      { status: response.ok ? 502 : response.status }
    );
  }

  const data = await response.json();
  return NextResponse.json(data, { status: response.ok ? 200 : response.status });
}
