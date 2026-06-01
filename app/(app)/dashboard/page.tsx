import { ChatHomePage } from "@/components/chat/chat-home-page";
import { getAuthSession, getSessionDisplayName } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getAuthSession();
  const displayName = session ? getSessionDisplayName(session) : "there";

  return <ChatHomePage displayName={displayName} />;
}
