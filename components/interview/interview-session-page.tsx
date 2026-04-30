"use client";

import { InterviewChatPage } from "@/components/interview/interview-chat-page";
import { InterviewOnboardingForm } from "@/components/interview/interview-onboarding-form";
import { InterviewStateScreen } from "@/components/interview/interview-state-screen";
import { InterviewSessionContext, useInterviewSession } from "@/hooks/use-interview-session";

interface InterviewSessionPageProps {
  shareToken: string;
}

export function InterviewSessionPage({ shareToken }: InterviewSessionPageProps) {
  const session = useInterviewSession(shareToken);

  if (session.phase === "loading") {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12 sm:py-16">
        <div className="w-full space-y-3 border border-border/60 bg-background p-6 shadow-xs">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Loading interview</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Please wait while we open your link.
          </p>
        </div>
      </div>
    );
  }

  if (session.phase === "invalid") {
    return (
      <InterviewStateScreen
        title="This interview link is invalid or has expired."
        message={session.errorMessage ?? undefined}
      />
    );
  }

  if (session.phase === "closed") {
    return (
      <InterviewStateScreen
        title="This interview is not currently accepting responses."
        message={session.errorMessage ?? undefined}
      />
    );
  }

  if (session.phase === "completed") {
    return (
      <InterviewStateScreen
        title="You have already completed this interview. Thank you."
        message={session.errorMessage ?? undefined}
      />
    );
  }

  if (session.phase === "onboarding") {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-start px-4 py-12 sm:items-center sm:py-16">
        <div className="w-full space-y-5">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Before we start</h1>
            <p className="max-w-prose text-sm leading-6 text-muted-foreground">
              Tell us who this is from so the interview record is easier to analyse later.
            </p>
          </div>
          <div className="border border-border/60 bg-background p-5 shadow-xs sm:p-6">
            <InterviewOnboardingForm onSubmit={session.submitDetails} />
          </div>
        </div>
      </div>
    );
  }

  if (!session.contextValue) {
    return <InterviewStateScreen title="This interview could not be opened." />;
  }

  return (
    <InterviewSessionContext.Provider value={session.contextValue}>
      <InterviewChatPage shareToken={shareToken} />
    </InterviewSessionContext.Provider>
  );
}
