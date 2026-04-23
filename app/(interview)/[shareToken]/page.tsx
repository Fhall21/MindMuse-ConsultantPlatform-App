import { InterviewSessionPage } from "@/components/interview/interview-session-page";

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;

  return <InterviewSessionPage shareToken={shareToken} />;
}
