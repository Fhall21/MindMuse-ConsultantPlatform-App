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
import { useConsultationRounds, useConsultations } from "@/hooks/use-consultations";
import type { Consultation } from "@/types/db";

type StatusFilter = "all" | "draft" | "complete";

interface ConsultationListRow extends Consultation {
  roundLabel: string | null;
  peopleCount: number;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ConsultationsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [titleFilter, setTitleFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);

  const consultationsQuery = useConsultations();
  const roundsQuery = useConsultationRounds();

  const consultations = consultationsQuery.data;

  const consultationIds = useMemo(
    () => (consultations ?? []).map((consultation) => consultation.id),
    [consultations]
  );

  const peopleCountsQuery = useQuery({
    queryKey: ["consultation_people_counts", consultationIds],
    queryFn: () =>
      fetchJson<Record<string, number>>("/api/client/consultations/people-counts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: consultationIds }),
      }),
    enabled: consultationIds.length > 0,
  });

  const rows = useMemo<ConsultationListRow[]>(() => {
    const roundLabelById = new Map(
      (roundsQuery.data ?? []).map((round) => [round.id, round.label])
    );
    const peopleCounts = peopleCountsQuery.data ?? {};

    return (consultations ?? []).slice(0, 200).map((consultation) => ({
      ...consultation,
      roundLabel: consultation.round_id
        ? (roundLabelById.get(consultation.round_id) ?? null)
        : null,
      peopleCount: peopleCounts[consultation.id] ?? 0,
    }));
  }, [consultations, roundsQuery.data, peopleCountsQuery.data]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = titleFilter.trim().toLowerCase();

    return rows.filter((row) => {
      const statusMatch = statusFilter === "all" || row.status === statusFilter;
      const titleMatch =
        normalizedSearch.length === 0 ||
        row.title.toLowerCase().includes(normalizedSearch);

      return statusMatch && titleMatch;
    });
  }, [rows, statusFilter, titleFilter]);

  const columns = useMemo<ColumnDef<ConsultationListRow>[]>(
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
            href={`/consultations/${row.original.id}`}
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
        accessorKey: "roundLabel",
        header: "Round",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.roundLabel ?? "-"}</span>
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
          <Button variant="link" className="h-auto p-0" asChild>
            <Link href={`/consultations/${row.original.id}`}>Open</Link>
          </Button>
        ),
      },
    ],
    []
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
    consultationsQuery.isLoading || roundsQuery.isLoading || peopleCountsQuery.isLoading;
  const hasNoConsultations = !isLoading && rows.length === 0;
  const hasNoFilteredRows = !isLoading && rows.length > 0 && filteredRows.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">All consultations</h2>
          <p className="text-sm text-muted-foreground">
            Search, filter, and open consultation records from here.
          </p>
        </div>
        <Button asChild>
          <Link href="/consultations/new">New Consultation</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="all">All</option>
          <option value="draft">Draft</option>
          <option value="complete">Complete</option>
        </select>
        <Input
          value={titleFilter}
          onChange={(event) => setTitleFilter(event.target.value)}
          placeholder="Search by title"
          className="w-full sm:max-w-xs"
        />
      </div>

      {hasNoConsultations ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="mb-4 text-muted-foreground">No consultations yet.</p>
          <Button asChild size="lg">
            <Link href="/consultations/new">New Consultation</Link>
          </Button>
        </div>
      ) : hasNoFilteredRows ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No matching consultations.
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
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
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
