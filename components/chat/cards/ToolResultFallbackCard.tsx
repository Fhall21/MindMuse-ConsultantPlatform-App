import { ChatToolCardShell } from "./chat-tool-card-shell";

export function ToolResultFallbackCard() {
  return (
    <ChatToolCardShell
      title="Could not display this response"
      description="Please try the request again. If it keeps happening, refresh the page."
    />
  );
}
