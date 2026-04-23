import { FlowBuilder } from "@/components/digital-interviews/flow-builder";

export const metadata = {
  title: "New digital interview",
};

export default function NewDigitalInterviewPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">New digital interview</h1>
        <p className="text-sm text-muted-foreground">
          Configure an AI-guided interview and get a shareable link for interviewees.
        </p>
      </div>

      <FlowBuilder />
    </div>
  );
}
