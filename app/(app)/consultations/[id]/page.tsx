import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { requireCurrentUserId } from "@/lib/data/auth-context";
import { getConsultationForUser, listMeetingsForConsultation } from "@/lib/data/domain-read";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h2>
  );
}

export default async function ConsultationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireCurrentUserId();
  const [consultation, meetings] = await Promise.all([
    getConsultationForUser(id, userId),
    listMeetingsForConsultation(id, userId),
  ]);

  if (!consultation) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-4 rounded-xl border bg-card p-6">
        <nav className="text-sm text-muted-foreground">
          <Link href="/consultations" className="hover:text-foreground">
            Consultations
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{consultation.label}</span>
        </nav>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{consultation.label}</h1>
              <Badge variant="outline">{meetings.length} linked meetings</Badge>
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              {consultation.description ?? "Grouped consultation workspace for linked meeting evidence."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <Link href="/reports">Reports</Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <Link href={`/canvas/round/${id}`}>Evidence canvas -&gt;</Link>
            </Button>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <SectionHeading>Linked Meetings</SectionHeading>
        <div className="grid gap-3">
          {meetings.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No meetings are linked to this consultation yet.
            </div>
          ) : (
            meetings.map((meeting) => (
              <div
                key={meeting.id}
                className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="font-medium">{meeting.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {meeting.status === "complete" ? "Complete" : "Draft"}
                  </p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/meetings/${meeting.id}`}>Open meeting</Link>
                </Button>
              </div>
            ))
          )}
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <SectionHeading>Next Step</SectionHeading>
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          Use the evidence canvas to review grouped themes and relationships across the linked meetings.
        </div>
      </section>
    </div>
  );
}
