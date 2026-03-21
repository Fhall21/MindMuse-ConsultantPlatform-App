/**
 * OpenAI client for server-side use only.
 * In v1, LLM calls go through the FastAPI AI service,
 * but this client is available for direct use if needed.
 */

import { requireEnv } from "@/lib/env";

export async function callAIService(
  endpoint: string,
  body: Record<string, unknown>
) {
  const aiServiceUrl = requireEnv("AI_SERVICE_URL");
  const response = await fetch(`${aiServiceUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const responseText = (await response.text()).trim();
    const responseSnippet =
      responseText.length > 500
        ? `${responseText.slice(0, 500)}...`
        : responseText;
    console.error("[openai.callAIService] upstream request failed", {
      endpoint,
      status: response.status,
      statusText: response.statusText,
      responseSnippet,
    });
    throw new Error(
      `AI service error: ${response.status}${responseSnippet ? ` - ${responseSnippet}` : ""}`
    );
  }

  try {
    return await response.json();
  } catch (error) {
    console.error("[openai.callAIService] failed to parse JSON response", {
      endpoint,
      error,
    });
    throw error;
  }
}
