"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchJson } from "@/hooks/api";
import {
  useArchiveMeeting,
  useMeetings,
  useRestoreMeeting,
} from "@/hooks/use-meetings";
import type { Meeting } from "@/types/db";
import { toast } from "sonner";

type MeetingView = "draft" | "complete" | "archived";

interface MeetingListRow extends Meeting {
  consultationLabel: string | null;
  peopleCount: number;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function MeetingsPage() {
  const [view, setView] = useState<MeetingView>("draft");
  const [titleFilter, setTitleFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);

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

  const meetingIds = useMemo(
    () => (meetings ?? []).map((meeting) => meeting.id),
    [meetings]
  );

  const peopleCountsQuery = useQuery({
    queryKey: ["consultation_people_counts", meetingIds],
    queryFn: () =>
      fetchJson<Record<string, number>>("/api/client/meetings/people-counts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: meetingIds }),
      }),
    enabled: meetingIds.length > 0,
  });

  const rows = useMemo<MeetingListRow[]>(() => {
    const peopleCounts = peopleCountsQuery.data ?? {};

    return (meetings ?? []).slice(0, 200).map((meeting) => ({
      ...meeting,
      consultationLabel: null,
      peopleCount: peopleCounts[meeting.id] ?? 0,
    }));
  }, [meetings, peopleCountsQuery.data]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = titleFilter.trim().toLowerCase();
    if (!normalizedSearch) return rows;
    return rows.filter((row) =>
      row.title.toLowerCase().includes(normalizedSearch)
    );
  }, [rows, titleFilter]);

  const columns = useMemo<ColumnDef<MeetingListRow>[]>(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-0"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Title
          </Button>
        ),
        cell: ({ row }) => (
          <Link
            href={`/meetings/${row.original.id}`}
            className="font-medium hover:underline"
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          if (row.original.is_archived) {
            return <Badge variant="outline">Archived</Badge>;
          }

          if (row.original.status === "complete") {
            return (
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                Complete
              </Badge>
            );
          }

          return <Badge variant="secondary">Draft</Badge>;
        },
      },
      {
        accessorKey: "consultationLabel",
        header: "Consultation",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.consultationLabel ?? "-"}</span>
        ),
      },
      {
        accessorKey: "peopleCount",
        header: "People",
        cell: ({ row }) => {
          const count = row.original.peopleCount;
          if (count === 0) {
            return <span className="text-muted-foreground">-</span>;
          }
          return `${count} ${count === 1 ? "person" : "people"}`;
        },
      },
      {
        accessorKey: "created_at",
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-0"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Created
          </Button>
        ),
        cell: ({ row }) => formatDate(row.original.created_at),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button variant="link" className="h-auto p-0" asChild>
              <Link href={`/meetings/${row.original.id}`}>Open</Link>
            </Button>
            {row.original.is_archived ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={restoreMeeting.isPending}
                onClick={() => {
                  restoreMeeting.mutate(row.original.id, {
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
                className="h-7 px-2 text-xs"
                disabled={archiveMeeting.isPending}
                onClick={() => {
                  archiveMeeting.mutate(row.original.id, {
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
        ),
      },
    ],
    [archiveMeeting, restoreMeeting]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const isLoading =
    (view === "archived" ? archivedMeetingsQuery.isLoading : activeMeetingsQuery.isLoading) ||
    peopleCountsQuery.isLoading;
  const hasNoMeetings = !isLoading && rows.length === 0;
  const hasNoFilteredRows = !isLoading && rows.length > 0 && filteredRows.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Meetings</h2>
          <p className="text-sm text-muted-foreground">Open, archive, or restore meetings.</p>
        </div>
        <Button asChild>
          <Link href="/meetings/new">New Meeting</Link>
        </Button>
      </div>

      <div className="flex items-center gap-2">
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={titleFilter}
          onChange={(event) => setTitleFilter(event.target.value)}
          placeholder="Search by title"
          className="w-full sm:max-w-xs"
        />
      </div>

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
      ) : (
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}