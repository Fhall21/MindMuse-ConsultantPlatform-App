import { InterviewSessionPage } from "@/components/interview/interview-session-page";

export default async function InterviewAliasPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;

  return <InterviewSessionPage shareToken={shareToken} />;
}
