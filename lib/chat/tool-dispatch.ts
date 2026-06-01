import { getAiServiceUrl } from "@/lib/env";
import { assertAllowedFastApiPath } from "./tool-allowlist";
import { createChatServiceToken } from "./service-token";

const TOOL_DISPATCH_TIMEOUT_MS = 30_000;

export async function dispatchToolToFastApi(params: {
  userId: string;
  sessionId: string;
  endpoint: string;
  body: Record<string, unknown>;
}): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  let path: string;
  try {
    path = assertAllowedFastApiPath(params.endpoint);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Tool dispatch blocked",
    };
  }

  const aiServiceUrl = getAiServiceUrl();
  const token = createChatServiceToken({
    userId: params.userId,
    sessionId: params.sessionId,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TOOL_DISPATCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${aiServiceUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params.body),
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      const text = await response.text();
      return {
        ok: false,
        error: text || `AI service returned ${response.status}`,
      };
    }

    const data = await response.json();
    if (!response.ok) {
      const detail =
        typeof data === "object" && data && "detail" in data
          ? String((data as { detail: unknown }).detail)
          : `AI service error ${response.status}`;
      return { ok: false, error: detail };
    }

    return { ok: true, data };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, error: "AI service request timed out" };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "AI service unreachable",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
