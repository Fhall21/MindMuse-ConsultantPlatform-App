"use client";

import { useMemo } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon, Edit01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Person } from "@/types/db";

export interface PersonTableRow extends Person {
  consultationCount: number;
}

interface PersonTableProps {
  data: PersonTableRow[];
  onEdit: (person: Person) => void;
  onDelete: (person: Person) => void;
  onRowClick: (personId: string) => void;
}

export function PersonTable({ data, onEdit, onDelete, onRowClick }: PersonTableProps) {
  const columns = useMemo<ColumnDef<PersonTableRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "working_group",
        header: "Working Group",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.working_group || "-"}
          </span>
        ),
      },
      {
        accessorKey: "work_type",
        header: "Work Type",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.work_type || "-"}</span>
        ),
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.role || "-"}</span>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.email || "-"}</span>
        ),
      },
      {
        accessorKey: "consultationCount",
        header: "Consultations",
        cell: ({ row }) => {
          const count = row.original.consultationCount;
          if (count === 0) {
            return <span className="text-muted-foreground">-</span>;
          }

          return `${count} ${count === 1 ? "consultation" : "consultations"}`;
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              aria-label="Edit person"
              title="Edit"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(row.original);
              }}
            >
              <HugeiconsIcon icon={Edit01Icon} strokeWidth={2} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              className="text-destructive hover:text-destructive"
              aria-label="Delete person"
              title="Delete"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(row.original);
              }}
            >
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
            </Button>
          </div>
        ),
      },
    ],
    [onDelete, onEdit]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
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
          <TableRow
            key={row.id}
            className="cursor-pointer"
            onClick={() => onRowClick(row.original.id)}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
