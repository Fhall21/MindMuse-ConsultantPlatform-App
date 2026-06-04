"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AuditTrail } from "@/components/audit/audit-trail";
import { ThemePanel } from "@/components/consultations/theme-panel";
import { QuoteReviewPanel } from "@/components/consultations/quote-review-panel";
import { EmailDraftPanel } from "@/components/evidence/email-draft-panel";
import { TranscriptIntakePanel } from "@/components/consultations/transcript-intake-panel";
import { OcrReviewPanel } from "@/components/consultations/ocr-review-panel";
import { NotesEditor } from "@/components/consultations/notes-editor";
import { PeoplePanel } from "@/components/consultations/people-panel";
import { RoundsPanel } from "@/components/consultations/rounds-panel";
import { useMeeting } from "@/hooks/use-meetings";
import { useConsultations } from "@/hooks/use-consultations";
import { useMeetingTypes } from "@/hooks/use-meeting-types";
import {
  markMeetingComplete,
  updateMeetingTitle,
  updateMeetingFields,
  archiveMeeting,
  restoreMeeting,
} from "@/lib/actions/consultations";
import { buildMeetingTitle } from "@/lib/meeting-title";
import { cn } from "@/lib/utils";

type WorkflowTab = "capture" | "analysis" | "audit";

const TAB_VALUES: ReadonlyArray<WorkflowTab> = ["capture", "analysis", "audit"];

const TAB_LABELS: Record<WorkflowTab, string> = {
  capture: "Capture",
  analysis: "Analysis",
  audit: "Audit",
};

const TAB_INNER_ANCHORS: Record<WorkflowTab, ReadonlyArray<{ id: string; label: string }>> = {
  capture: [
    { id: "transcript", label: "Transcript" },
    { id: "handwritten-notes", label: "Notes photo" },
    { id: "notes", label: "Notes" },
  ],
  analysis: [
    { id: "themes", label: "Themes" },
    { id: "quotes", label: "Quotes" },
    { id: "evidence-email", label: "Evidence email" },
  ],
  audit: [],
};

function isWorkflowTab(value: string | null): value is WorkflowTab {
  return value === "capture" || value === "analysis" || value === "audit";
}

/**
 * Thin in-tab anchor strip. Renders only when the tab has 2+ sections — a
 * one-section tab doesn't need it. Visually muted so it never competes with
 * the tab strip above for primary navigation weight.
 */
function TabAnchorRow({ tab }: { tab: WorkflowTab }) {
  const anchors = TAB_INNER_ANCHORS[tab];
  if (anchors.length < 2) return null;
  return (
    <nav
      aria-label={`${TAB_LABELS[tab]} sections`}
      className="-mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
    >
      {anchors.map((anchor, index) => (
        <span key={anchor.id} className="contents">
          {index > 0 && <span aria-hidden="true">·</span>}
          <a
            href={`#${anchor.id}`}
            className="rounded px-0.5 underline-offset-2 hover:text-foreground hover:underline"
          >
            {anchor.label}
          </a>
        </span>
      ))}
    </nav>
  );
}

export default function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useMeeting(id);
  const { data: rounds } = useConsultations();
  const { data: meetingTypes = [] } = useMeetingTypes();

  const router = useRouter();
  const searchParams = useSearchParams();

  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [savingFields, setSavingFields] = useState(false);

  const meeting = data?.meeting;
  const isDraft = meeting?.status === "draft";
  const isArchived = meeting?.is_archived ?? false;
  const isEditable = Boolean(meeting && isDraft && !isArchived);

  const transcriptIsEmpty = !meeting?.transcript_raw?.trim();
  const tabParam = searchParams.get("tab");
  const activeTab: WorkflowTab = useMemo(() => {
    if (isWorkflowTab(tabParam)) return tabParam;
    return transcriptIsEmpty ? "capture" : "analysis";
  }, [tabParam, transcriptIsEmpty]);

  const setTab = useCallback(
    (next: string) => {
      if (!isWorkflowTab(next) || next === activeTab) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [activeTab, router, searchParams]
  );

  const currentConsultation = rounds?.find((consultation) => consultation.id === meeting?.consultation_id) ?? null;
  const normalizedSavedTitle = meeting?.title.trim() ?? "";
  const normalizedDraftTitle = titleDraft.trim();
  const titleChanged = normalizedDraftTitle !== normalizedSavedTitle;
  const titleInvalid = normalizedDraftTitle.length === 0 || normalizedDraftTitle.length > 255;

  useEffect(() => {
    setTitleDraft(meeting?.title ?? "");
  }, [meeting?.title]);

  async function handleMarkComplete() {
    setCompleting(true);
    try {
      await markMeetingComplete(id);
      await queryClient.invalidateQueries({ queryKey: ["meetings", id] });
      await queryClient.invalidateQueries({ queryKey: ["meetings"] });
      setConfirmCompleteOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to mark meeting as complete.");
    } finally {
      setCompleting(false);
    }
  }

  async function handleSaveTitle() {
    if (!meeting || savingTitle || !titleChanged || titleInvalid || isArchived) return;

    setSavingTitle(true);
    try {
      await updateMeetingTitle({ id, title: titleDraft });
      await queryClient.invalidateQueries({ queryKey: ["meetings", id] });
      await queryClient.invalidateQueries({ queryKey: ["meetings"] });
      toast.success("Meeting title updated.");
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to update meeting title.";
      toast.error(message);
    } finally {
      setSavingTitle(false);
    }
  }

  async function handleSaveFields(opts: { meetingTypeId?: string | null; meetingDate?: Date | null }) {
    if (!meeting || isArchived) return;
    setSavingFields(true);
    try {
      await updateMeetingFields({ id, ...opts });
      await queryClient.invalidateQueries({ queryKey: ["meetings", id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update meeting.");
    } finally {
      setSavingFields(false);
    }
  }

  function handleRegenerateTitle() {
    if (!meeting || isArchived) return;
    const selectedType = meetingTypes.find((t) => t.id === meeting.meeting_type_id);
    // We don't have people's names readily here; use empty for now
    const date = meeting.meeting_date ? new Date(meeting.meeting_date) : null;
    const generated = buildMeetingTitle(selectedType?.code, [], date);
    if (generated) setTitleDraft(generated);
  }

  async function handleArchive() {
    if (!meeting) return;
    try {
      await archiveMeeting(id);
      await queryClient.invalidateQueries({ queryKey: ["meetings", id] });
      await queryClient.invalidateQueries({ queryKey: ["meetings"] });
      toast.success("Meeting archived.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to archive meeting.");
    }
  }

  async function handleRestore() {
    if (!meeting) return;
    try {
      await restoreMeeting(id);
      await queryClient.invalidateQueries({ queryKey: ["meetings", id] });
      await queryClient.invalidateQueries({ queryKey: ["meetings"] });
      toast.success("Meeting restored.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to restore meeting.");
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">
          Failed to load meeting. It may not exist or you may not have access.
        </p>
        <Button variant="ghost" asChild>
          <Link href="/meetings">Back to meetings</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 sm:px-6">
      {/* Header */}
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <nav className="text-sm text-muted-foreground">
          <Link href="/meetings" className="hover:text-foreground">
            Meetings
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{normalizedSavedTitle}</span>
        </nav>

        <div className="space-y-4 rounded-xl border border-border/50 bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="space-y-2">
                <label
                  htmlFor="meeting-title"
                  className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  Meeting title
                </label>
                <Input
                  id="meeting-title"
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSaveTitle();
                    }
                  }}
                  placeholder="Enter meeting title"
                  className="h-11 text-base font-semibold sm:text-lg"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveTitle}
                  disabled={!titleChanged || titleInvalid || savingTitle || !isEditable}
                >
                  {savingTitle ? "Saving…" : "Save title"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setTitleDraft(meeting.title)}
                  disabled={!titleChanged || savingTitle || !isEditable}
                >
                  Reset
                </Button>
                <span className="text-xs text-muted-foreground">
                  {titleInvalid
                    ? "Title must be between 1 and 255 characters."
                    : titleChanged
                      ? "Unsaved title changes"
                      : "Title saved"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {isArchived ? <Badge variant="outline">Archived</Badge> : null}
              <Badge variant={isDraft ? "outline" : "secondary"}>
                {isDraft ? "Draft" : "Complete"}
              </Badge>
              {isDraft && !isArchived && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmCompleteOpen(true)}
                >
                  Mark complete
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 w-8 px-0">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <circle cx="12" cy="5" r="1" />
                      <circle cx="12" cy="12" r="1" />
                      <circle cx="12" cy="19" r="1" />
                    </svg>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isArchived ? (
                    <DropdownMenuItem onClick={handleRestore}>
                      Restore
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={handleArchive}>
                      Archive
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="space-y-5 border-t pt-4">
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Project
                </p>
                <RoundsPanel
                  meetingId={id}
                  currentRoundId={meeting.consultation_id}
                  currentRoundLabel={currentConsultation?.label ?? null}
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Meeting Type
                </p>
                <div className="relative">
                  <select
                    value={meeting.meeting_type_id ?? ""}
                    onChange={(e) =>
                      handleSaveFields({ meetingTypeId: e.target.value || null })
                    }
                    disabled={savingFields}
                    className="flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 pr-7 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <option value="">Not set</option>
                    {meetingTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    title="Regenerate title from type and date"
                    onClick={handleRegenerateTitle}
                    disabled={!isEditable}
                  >
                    Regenerate
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Date
                </p>
                <Input
                  type="date"
                  defaultValue={
                    meeting.meeting_date
                      ? new Date(meeting.meeting_date).toISOString().slice(0, 10)
                      : ""
                  }
                  onBlur={(e) =>
                    handleSaveFields({
                      meetingDate: e.target.value ? new Date(e.target.value + "T12:00:00") : null,
                    })
                  }
                  disabled={savingFields || !isEditable}
                  className="h-9 w-full text-sm"
                />
              </div>
            </div>

            {!isDraft && meeting.consultation_id ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/consultations/rounds/${meeting.consultation_id}`}>
                    Open project workspace &rarr;
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/canvas/round/${meeting.consultation_id}`}>
                    Evidence canvas &rarr;
                  </Link>
                </Button>
                <span className="text-xs text-muted-foreground">
                  View theme grouping, synthesis, and project outputs
                </span>
              </div>
            ) : null}

            <div className="space-y-3 border-t pt-5">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Participants
                </p>
                <p className="text-sm text-muted-foreground">
                  Keep participant linking explicit before transcription and theme work so speaker context stays trustworthy.
                </p>
              </div>
              <PeoplePanel meetingId={id} />
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setTab}>
        <div className="sticky top-3 z-30 mx-auto w-full max-w-2xl overflow-x-auto rounded-xl border border-border/60 bg-background/90 p-2 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <nav
            role="tablist"
            aria-label="Meeting workflow stages"
            className="flex min-w-max items-center gap-2"
          >
            {TAB_VALUES.map((value) => {
              const isActive = activeTab === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setTab(value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isActive
                      ? "border-border/60 bg-muted/60 text-foreground"
                      : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/40 hover:text-foreground"
                  )}
                >
                  {TAB_LABELS[value]}
                </button>
              );
            })}
          </nav>
        </div>

        <TabsContent value="capture" className="mx-auto w-full max-w-2xl space-y-8">
          <TabAnchorRow tab="capture" />

          <section id="transcript" className="scroll-mt-28 space-y-3">
            <SectionHeading>Transcript</SectionHeading>
            <TranscriptIntakePanel
              meetingId={id}
              initialTranscript={meeting.transcript_raw}
              readOnly={!isDraft}
            />
          </section>

          <Separator />

          <section id="handwritten-notes" className="scroll-mt-28 space-y-3">
            <SectionHeading>Handwritten notes photo</SectionHeading>
            <OcrReviewPanel meetingId={id} />
          </section>

          <Separator />

          <section id="notes" className="scroll-mt-28 space-y-3">
            <SectionHeading>Notes</SectionHeading>
            <NotesEditor
              meetingId={id}
              initialValue={meeting.notes}
              readOnly={!isDraft}
            />
          </section>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-10">
          <div className="mx-auto w-full max-w-2xl">
            <TabAnchorRow tab="analysis" />
          </div>

          <section
            id="themes"
            className="mx-auto w-full max-w-2xl scroll-mt-28 space-y-3"
          >
            <SectionHeading>Themes</SectionHeading>
            <ThemePanel meetingId={id} />
          </section>

          <Separator className="mx-auto w-full max-w-2xl" />

          {/* Quotes uses the full Analysis canvas for proper QDA workspace */}
          <section id="quotes" className="scroll-mt-28 space-y-3">
            <div className="mx-auto w-full max-w-2xl">
              <SectionHeading>Quotes</SectionHeading>
            </div>
            <QuoteReviewPanel meetingId={id} />
          </section>

          <Separator className="mx-auto w-full max-w-2xl" />

          <section
            id="evidence-email"
            className="mx-auto w-full max-w-2xl scroll-mt-28 space-y-3"
          >
            <SectionHeading>Evidence email</SectionHeading>
            <EmailDraftPanel meetingId={id} />
          </section>
        </TabsContent>

        <TabsContent value="audit" className="mx-auto w-full max-w-2xl space-y-3">
          <p className="text-sm text-muted-foreground">
            Every theme decision, transcript edit, and quote action recorded for this meeting.
          </p>
          <AuditTrail meetingId={id} />
        </TabsContent>
      </Tabs>

      {/* Mark Complete confirmation */}
      <Dialog open={confirmCompleteOpen} onOpenChange={setConfirmCompleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark as complete?</DialogTitle>
            <DialogDescription>
              This cannot be undone. The transcript will become read-only.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmCompleteOpen(false)}
              disabled={completing}
            >
              Cancel
            </Button>
            <Button onClick={handleMarkComplete} disabled={completing}>
              {completing ? "Saving…" : "Mark complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
