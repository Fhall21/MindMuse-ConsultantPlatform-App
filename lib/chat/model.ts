/** Default chat agent model — OpenAI GPT-5.4 mini. Override with CHAT_MODEL. */
export const DEFAULT_CHAT_MODEL = "gpt-5.4-mini";

export function getChatModel(): string {
  const configured = process.env.CHAT_MODEL?.trim();
  return configured || DEFAULT_CHAT_MODEL;
}
