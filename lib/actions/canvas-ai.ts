"use server";

import OpenAI from "openai";

/**
 * Uses OpenAI to suggest a concise theme group label from a set of insight
 * labels and descriptions. Returns null if the API key is not configured or
 * the call fails — callers should treat null as "use default label".
 */
export async function suggestGroupLabel(
  insightLabels: string[],
  insightDescriptions: (string | null)[]
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  if (insightLabels.length === 0) {
    return null;
  }

  try {
    const openai = new OpenAI({ apiKey });

    const lines = insightLabels
      .map((label, i) => {
        const desc = insightDescriptions[i];
        return desc ? `- ${label}: ${desc}` : `- ${label}`;
      })
      .join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert psychosocial consultant helping to name theme groups in a consultation evidence canvas. Respond with ONLY the group title — 2 to 6 words, title case, no punctuation.",
        },
        {
          role: "user",
          content: `Suggest a concise theme group title for these consultation insights:\n${lines}`,
        },
      ],
      max_tokens: 20,
      temperature: 0.6,
    });

    const suggestion = response.choices[0]?.message.content?.trim();
    return suggestion ?? null;
  } catch (error) {
    console.error("[canvas-ai.suggestGroupLabel] failed", { error });
    return null;
  }
}
