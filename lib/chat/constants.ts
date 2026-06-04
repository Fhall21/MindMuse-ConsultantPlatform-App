export const CHAT_MESSAGE_HISTORY_LIMIT = 50;
export const CHAT_MAX_TOOL_ROUNDTRIPS = 5;
export const CHAT_CONSECUTIVE_TOOL_ERROR_HINT_THRESHOLD = 3;
export const CHAT_SERVICE_TOKEN_TTL_MS = 5 * 60 * 1000;
/** Session id for Next.js API proxies that are not tied to a chat_sessions row. */
export const API_PROXY_SESSION_ID = "api-proxy";
export const CHAT_MAX_CLIENT_MESSAGES = 100;
export const CHAT_MAX_MESSAGE_PARTS = 25;
export const CHAT_MAX_USER_MESSAGE_CHARS = 120_000;

export const MANUAL_NAV_HINT =
  "Some actions are failing repeatedly. You can continue from the sidebar: Meetings, Consultations, or Canvas.";

/** Welcome + composer quick actions — outline, muted, 44px touch target. */
export const CHAT_QUICK_ACTION_BUTTON_CLASS =
  "min-h-11 h-auto border-border/80 bg-background px-3 py-2 text-sm font-normal shadow-xs hover:bg-muted/80";

/** Composer suggested replies — same outline treatment as ChatHomeView example prompts. */
export const CHAT_SUGGESTED_REPLY_CHIP_CLASS =
  "inline-flex min-h-9 items-center rounded-md border border-border/60 bg-background px-3 py-2 text-left text-sm font-normal text-muted-foreground shadow-none transition-colors hover:border-border hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
