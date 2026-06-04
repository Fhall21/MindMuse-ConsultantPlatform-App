import { NextRequest, NextResponse } from "next/server";
import { API_PROXY_SESSION_ID } from "@/lib/chat/constants";
import { isChatProtectedFastApiPath } from "@/lib/chat/protected-paths";
import { createChatServiceToken } from "@/lib/chat/service-token";
import { getAiServiceUrl } from "@/lib/env";
import { getCurrentUserId } from "@/lib/data/auth-context";

export type AiProxyAuth = {
  userId: string;
  sessionId?: string;
};

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

function buildAiProxyAuthHeaders(
  path: string,
  auth?: AiProxyAuth
): Record<string, string> | NextResponse {
  if (!isChatProtectedFastApiPath(path)) {
    return {};
  }

  if (!auth?.userId) {
    console.error("[ai-proxy] missing auth for protected FastAPI path:", path);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }

  const token = createChatServiceToken({
    userId: auth.userId,
    sessionId: auth.sessionId ?? API_PROXY_SESSION_ID,
  });

  return { Authorization: `Bearer ${token}` };
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
  payload: unknown,
  auth?: AiProxyAuth
): Promise<NextResponse> {
  const authHeaders = buildAiProxyAuthHeaders(path, auth);
  if (authHeaders instanceof NextResponse) {
    return authHeaders;
  }

  let response: Response;

  try {
    response = await fetchWithTimeout(`${aiServiceUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
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
  formData: FormData,
  auth?: AiProxyAuth
): Promise<NextResponse> {
  const authHeaders = buildAiProxyAuthHeaders(path, auth);
  if (authHeaders instanceof NextResponse) {
    return authHeaders;
  }

  let response: Response;

  try {
    response = await fetchWithTimeout(`${aiServiceUrl}${path}`, {
      method: "POST",
      headers: authHeaders,
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
