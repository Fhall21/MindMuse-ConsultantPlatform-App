/**
 * OpenAI client for server-side use only.
 * In v1, LLM calls go through the FastAPI AI service,
 * but this client is available for direct use if needed.
 */

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

export async function callAIService(
  endpoint: string,
  body: Record<string, unknown>
) {
  const response = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`AI service error: ${response.status}`);
  }

  return response.json();
}
