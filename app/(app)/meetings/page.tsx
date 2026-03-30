"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useArchiveMeeting,
  useMeetings,
  useRestoreMeeting,
} from "@/hooks/use-meetings";
import type { Meeting } from "@/types/db";
import { toast } from "sonner";

type MeetingView = "draft" | "complete" | "archived";
type MeetingSortBy = "newest" | "oldest" | "title-asc" | "title-desc";
type MeetingGroupBy = "none" | "consultation" | "people";

interface MeetingListRow extends Meeting {
  peopleCount: number;
}

interface MeetingGroup {
  id: string;
  label: string;
  description: string;
  rows: MeetingListRow[];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function normalizeNames(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function summarizeNames(values: string[], limit = 2) {
  if (values.length === 0) {
    return null;
  }

  if (values.length <= limit) {
    return values.join(" + ");
  }

  return `${values.slice(0, limit).join(" + ")} + ${values.length - limit} more`;
}

function formatMeetingStatus(meeting: Meeting) {
  if (meeting.is_archived) {
    return <Badge variant="outline">Archived</Badge>;
  }

  if (meeting.status === "complete") {
    return <Badge variant="default">Complete</Badge>;
  }

  return <Badge variant="secondary">Draft</Badge>;
}

function sortMeetings(rows: MeetingListRow[], sortBy: MeetingSortBy) {
  const sorted = [...rows];

  sorted.sort((left, right) => {
    const leftDate = new Date(left.created_at).getTime();
    const rightDate = new Date(right.created_at).getTime();

    switch (sortBy) {
      case "oldest":
        return leftDate - rightDate || left.title.localeCompare(right.title);
      case "title-asc":
        return left.title.localeCompare(right.title) || rightDate - leftDate;
      case "title-desc":
        return right.title.localeCompare(left.title) || rightDate - leftDate;
      case "newest":
      default:
        return rightDate - leftDate || left.title.localeCompare(right.title);
    }
  });

  return sorted;
}

function buildMeetingGroups(rows: MeetingListRow[], groupBy: MeetingGroupBy) {
  if (groupBy === "none") {
    return [] as MeetingGroup[];
  }

  const groups = new Map<string, MeetingGroup>();

  rows.forEach((row) => {
    const consultationLabel = row.consultation_label?.trim();
    const peopleNames = normalizeNames(row.people_names ?? []);

    if (groupBy === "consultation") {
      const key = row.consultation_id ?? "__no_consultation__";
      const label = consultationLabel || "No consultation linked";
      const existing = groups.get(key);

      if (existing) {
        existing.rows.push(row);
        return;
      }

      groups.set(key, {
        id: key,
        label,
        description:
          peopleNames.length > 0
            ? `People: ${summarizeNames(peopleNames)}`
            : "No people linked",
        rows: [row],
      });
      return;
    }

    const key = peopleNames.length > 0 ? peopleNames.join("||") : "__no_people__";
    const label = peopleNames.length > 0 ? summarizeNames(peopleNames) ?? "People linked" : "No people linked";
    const existing = groups.get(key);

    if (existing) {
      existing.rows.push(row);
      return;
    }

    groups.set(key, {
      id: key,
      label,
      description:
        consultationLabel || row.consultation_id
          ? `Consultation: ${consultationLabel || "Unlabeled consultation"}`
          : "No consultation linked",
      rows: [row],
    });
  });

  return Array.from(groups.values());
}

function formatGroupDescription(group: MeetingGroup, groupBy: MeetingGroupBy) {
  const countLabel = `${group.rows.length} meeting${group.rows.length === 1 ? "" : "s"}`;

  if (groupBy === "consultation") {
    const peopleSummary = summarizeNames(
      normalizeNames(group.rows.flatMap((row) => row.people_names ?? []))
    );

    return peopleSummary ? `${countLabel} · People: ${peopleSummary}` : `${countLabel} · No people linked`;
  }

  if (groupBy === "people") {
    const consultationSummary = summarizeNames(
      normalizeNames(group.rows.map((row) => row.consultation_label ?? null))
    );

    return consultationSummary
      ? `${countLabel} · Consultations: ${consultationSummary}`
      : `${countLabel} · No consultation linked`;
  }

  return countLabel;
}

export default function MeetingsPage() {
  const [view, setView] = useState<MeetingView>("draft");
  const [titleFilter, setTitleFilter] = useState("");
  const [sortBy, setSortBy] = useState<MeetingSortBy>("newest");
  const [groupBy, setGroupBy] = useState<MeetingGroupBy>("none");

  const activeMeetingsQuery = useMeetings();
  const archivedMeetingsQuery = useMeetings({ archivedOnly: true });
  const archiveMeeting = useArchiveMeeting();
  const restoreMeeting = useRestoreMeeting();

  const draftCount = useMemo(
    () => (activeMeetingsQuery.data ?? []).filter((m) => m.status === "draft").length,
    [activeMeetingsQuery.data]
  );
  const completeCount = useMemo(
    () => (activeMeetingsQuery.data ?? []).filter((m) => m.status === "complete").length,
    [activeMeetingsQuery.data]
  );
  const archivedCount = archivedMeetingsQuery.data?.length ?? 0;

  const meetings = useMemo(() => {
    if (view === "archived") return archivedMeetingsQuery.data ?? [];
    return (activeMeetingsQuery.data ?? []).filter((m) => m.status === view);
  }, [view, activeMeetingsQuery.data, archivedMeetingsQuery.data]);

  const rows = useMemo<MeetingListRow[]>(() => {
    return (meetings ?? []).slice(0, 200).map((meeting) => ({
      ...meeting,
      peopleCount: meeting.people_names?.length ?? 0,
    }));
  }, [meetings]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = titleFilter.trim().toLowerCase();
    if (!normalizedSearch) return rows;
    return rows.filter((row) =>
      row.title.toLowerCase().includes(normalizedSearch)
    );
  }, [rows, titleFilter]);

  const sortedRows = useMemo(
    () => sortMeetings(filteredRows, sortBy),
    [filteredRows, sortBy]
  );

  const groupedRows = useMemo(
    () => buildMeetingGroups(sortedRows, groupBy),
    [groupBy, sortedRows]
  );


  const isLoading =
    view === "archived" ? archivedMeetingsQuery.isLoading : activeMeetingsQuery.isLoading;
  const hasNoMeetings = !isLoading && rows.length === 0;
  const hasNoFilteredRows = !isLoading && rows.length > 0 && filteredRows.length === 0;

  const renderActions = (meeting: MeetingListRow) => (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="link" className="h-auto p-0" asChild>
        <Link href={`/meetings/${meeting.id}`}>Open</Link>
      </Button>
      {meeting.is_archived ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          disabled={restoreMeeting.isPending}
          onClick={() => {
            restoreMeeting.mutate(meeting.id, {
              onSuccess: () => {
                toast.success("Meeting restored");
              },
              onError: (error) => toast.error(error.message),
            });
          }}
        >
          Restore
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          disabled={archiveMeeting.isPending}
          onClick={() => {
            archiveMeeting.mutate(meeting.id, {
              onSuccess: () => {
                toast.success("Meeting archived");
              },
              onError: (error) => toast.error(error.message),
            });
          }}
        >
          Archive
        </Button>
      )}
    </div>
  );

  const renderMeetingRow = (meeting: MeetingListRow) => (
    <TableRow key={meeting.id}>
      <TableCell>
        <Link href={`/meetings/${meeting.id}`} className="font-medium hover:underline">
          {meeting.title}
        </Link>
      </TableCell>
      <TableCell>{formatMeetingStatus(meeting)}</TableCell>
      <TableCell>
        <span className="text-muted-foreground">{meeting.consultation_label ?? "-"}</span>
      </TableCell>
      <TableCell>
        {meeting.people_names && meeting.people_names.length > 0 ? (
          <span>{summarizeNames(meeting.people_names) ?? "-"}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>{formatDate(meeting.created_at)}</TableCell>
      <TableCell>{renderActions(meeting)}</TableCell>
    </TableRow>
  );

  const renderGroupedRow = (meeting: MeetingListRow) => (
    <div
      key={meeting.id}
      className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-3 shadow-[0_1px_0_rgba(0,0,0,0.02)] md:flex-row md:items-center md:justify-between"
    >
      <div className="min-w-0 space-y-1">
        <Link href={`/meetings/${meeting.id}`} className="truncate text-sm font-medium hover:underline">
          {meeting.title}
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {formatMeetingStatus(meeting)}
          <span>{formatDate(meeting.created_at)}</span>
          {meeting.consultation_label ? <span>{meeting.consultation_label}</span> : null}
          {meeting.people_names && meeting.people_names.length > 0 ? (
            <span>{summarizeNames(meeting.people_names)}</span>
          ) : null}
        </div>
      </div>
      {renderActions(meeting)}
    </div>
  );

  const renderGroupCard = (group: MeetingGroup) => (
    <Card key={group.id} size="sm" className="border-border/70 shadow-xs">
      <CardHeader>
        <div>
          <CardTitle>{group.label}</CardTitle>
          <CardDescription>{formatGroupDescription(group, groupBy)}</CardDescription>
        </div>
        <CardAction>
          <Badge variant="outline">{group.rows.length}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {group.rows.map((meeting) => renderGroupedRow(meeting))}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
          <p className="text-sm text-muted-foreground">Open, archive, or restore meetings.</p>
        </div>
        <Button asChild>
          <Link href="/meetings/new">New Meeting</Link>
        </Button>
      </div>

      <Card className="border-border/70 shadow-xs">
        <CardContent className="space-y-4 pt-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(11rem,13rem)_minmax(11rem,13rem)] lg:items-end">
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Search by title
              </div>
              <Input
                value={titleFilter}
                onChange={(event) => setTitleFilter(event.target.value)}
                placeholder="Search by title"
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Sort by
              </div>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as MeetingSortBy)}>
                <SelectTrigger>
                  <SelectValue placeholder="Newest first" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="title-asc">Title A-Z</SelectItem>
                  <SelectItem value="title-desc">Title Z-A</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Group by
              </div>
              <Select value={groupBy} onValueChange={(value) => setGroupBy(value as MeetingGroupBy)}>
                <SelectTrigger>
                  <SelectValue placeholder="No grouping" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No grouping</SelectItem>
                  <SelectItem value="consultation">Consultation round</SelectItem>
                  <SelectItem value="people">People involved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Quick filters
            </span>
            <Button
              type="button"
              size="sm"
              variant={view === "draft" ? "default" : "outline"}
              onClick={() => setView("draft")}
            >
              Draft ({draftCount})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === "complete" ? "default" : "outline"}
              onClick={() => setView("complete")}
            >
              Complete ({completeCount})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === "archived" ? "default" : "outline"}
              onClick={() => setView("archived")}
            >
              Archived ({archivedCount})
            </Button>
          </div>
        </CardContent>
      </Card>

      {hasNoMeetings ? (
        <div className="space-y-3 border-t border-border/80 pt-4">
          <p className="text-sm text-muted-foreground">
            {view === "draft" ? "No draft meetings." : view === "complete" ? "No completed meetings yet." : "No archived meetings."}
          </p>
          {view === "draft" ? (
            <Button asChild>
              <Link href="/meetings/new">New Meeting</Link>
            </Button>
          ) : null}
        </div>
      ) : hasNoFilteredRows ? (
        <div className="border-t border-border/80 pt-4 text-sm text-muted-foreground">
          No matching meetings.
        </div>
      ) : groupBy === "none" ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Consultation</TableHead>
              <TableHead>People</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{sortedRows.map((meeting) => renderMeetingRow(meeting))}</TableBody>
        </Table>
      ) : (
        <div className="space-y-4">
          {groupedRows.map((group) => renderGroupCard(group))}
        </div>
      )}
    </div>
  );
}