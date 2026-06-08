"use client";

import { useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { GripVertical, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GridCell } from "@/components/grid/grid-cell";
import { cn } from "@/lib/utils";
import type { Meeting } from "@/types/database";
import type {
  GridCell as GridCellData,
  GridColumn,
  GridReviewState,
  InsightWithLinks,
} from "@/types/grid";

export type GridMeeting = Pick<Meeting, "id" | "title">;

interface MatrixRow {
  meeting: GridMeeting;
  cellsByColumnId: Map<string, GridCellData>;
}

export interface GridMatrixProps {
  columns: GridColumn[];
  meetings: GridMeeting[];
  cells: GridCellData[];
  insightsByCellId: Map<string, InsightWithLinks[]>;
  insightsLoading?: boolean;
  selectedCellId: string | null;
  selectedInsightId: string | null;
  onCellSelect: (cellId: string) => void;
  onInsightSelect: (cellId: string, insightId: string) => void;
  onInsightReview: (
    insightId: string,
    state: GridReviewState,
    cellId: string,
    editedText?: string,
    editScope?: "cell" | "all"
  ) => void;
  onColumnDelete: (columnId: string) => void;
  onColumnRegenerate?: (columnId: string) => void;
  onCellRetry?: (meetingId: string) => void;
}

function SortableQuestionHeader({
  column,
  index,
  onDelete,
  onRegenerate,
}: {
  column: GridColumn;
  index: number;
  onDelete: () => void;
  onRegenerate?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group/header flex h-16 w-full items-center gap-1.5 bg-background px-2",
        isDragging && "z-30 opacity-70 shadow-md"
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        aria-label={`Reorder column ${index + 1}: ${column.question}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" aria-hidden="true" />
      </button>

      <Tooltip>
        <TooltipTrigger asChild>
          <span className="line-clamp-2 min-w-0 flex-1 text-left text-xs font-medium leading-4">
            {index + 1}. {column.question}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">{column.question}</TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover/header:opacity-100"
            aria-label={`Column actions: ${column.question}`}
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onRegenerate ? (
            <DropdownMenuItem
              onClick={(event) => {
                event.stopPropagation();
                onRegenerate();
              }}
            >
              <RotateCcw aria-hidden="true" />
              Regenerate
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            variant="destructive"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 aria-hidden="true" />
            Delete column
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function GridMatrix({
  columns,
  meetings,
  cells,
  insightsByCellId,
  insightsLoading = false,
  selectedCellId,
  selectedInsightId,
  onCellSelect,
  onInsightSelect,
  onInsightReview,
  onColumnDelete,
  onColumnRegenerate,
  onCellRetry,
}: GridMatrixProps) {
  const orderedColumns = useMemo(
    () => [...columns].sort((left, right) => left.position - right.position),
    [columns]
  );

  const rows = useMemo<MatrixRow[]>(() => {
    const cellsByMeeting = new Map<string, Map<string, GridCellData>>();
    for (const cell of cells) {
      const meetingCells =
        cellsByMeeting.get(cell.meetingId) ?? new Map<string, GridCellData>();
      meetingCells.set(cell.columnId, cell);
      cellsByMeeting.set(cell.meetingId, meetingCells);
    }

    return meetings.map((meeting) => ({
      meeting,
      cellsByColumnId:
        cellsByMeeting.get(meeting.id) ?? new Map<string, GridCellData>(),
    }));
  }, [cells, meetings]);

  const tableColumns = useMemo<ColumnDef<MatrixRow>[]>(
    () => [
      {
        id: "meeting",
        size: 176,
        header: () => (
          <div className="flex h-16 items-center px-3 text-xs font-medium">
            Meeting
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex min-h-28 flex-col justify-center gap-1 px-3 py-4">
            <span className="text-sm font-medium leading-5">
              {row.original.meeting.title}
            </span>
          </div>
        ),
      },
      ...orderedColumns.map<ColumnDef<MatrixRow>>((gridColumn, index) => ({
        id: gridColumn.id,
        size: 288,
        header: () => (
          <SortableQuestionHeader
            column={gridColumn}
            index={index}
            onDelete={() => onColumnDelete(gridColumn.id)}
            onRegenerate={
              onColumnRegenerate
                ? () => onColumnRegenerate(gridColumn.id)
                : undefined
            }
          />
        ),
        cell: ({ row }) => {
          const cell = row.original.cellsByColumnId.get(gridColumn.id);
          if (!cell) {
            return (
              <div className="flex min-h-28 w-72 items-center px-3 py-4 text-xs text-muted-foreground">
                Not generated
              </div>
            );
          }

          return (
            <GridCell
              cell={cell}
              insights={insightsByCellId.get(cell.id) ?? []}
              insightsLoading={insightsLoading}
              isSelected={selectedCellId === cell.id}
              selectedInsightId={selectedInsightId}
              onSelect={() => onCellSelect(cell.id)}
              onInsightSelect={(insightId) =>
                onInsightSelect(cell.id, insightId)
              }
              onInsightReview={(insightId, state, editedText, editScope) =>
                onInsightReview(
                  insightId,
                  state,
                  cell.id,
                  editedText,
                  editScope
                )
              }
              onRetry={
                onCellRetry ? () => onCellRetry(cell.meetingId) : undefined
              }
            />
          );
        },
      })),
    ],
    [
      insightsByCellId,
      insightsLoading,
      onCellRetry,
      onCellSelect,
      onColumnDelete,
      onColumnRegenerate,
      onInsightReview,
      onInsightSelect,
      orderedColumns,
      selectedCellId,
      selectedInsightId,
    ]
  );

  // TanStack Table returns mutable helpers that React Compiler intentionally skips.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
  });

  return (
    <div className="overflow-x-auto" aria-label="Analysis matrix">
      <table
        className="border-separate border-spacing-0 text-left"
        style={{ width: table.getTotalSize() }}
      >
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header, index) => (
                <th
                  key={header.id}
                  className={cn(
                    "border-r border-b bg-background p-0 align-top",
                    index === 0 && "sticky left-0 z-20"
                  )}
                  style={{ width: header.getSize() }}
                  scope="col"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell, index) => (
                <td
                  key={cell.id}
                  className={cn(
                    "border-r border-b bg-background p-0 align-top",
                    index === 0 && "sticky left-0 z-10"
                  )}
                  style={{ width: cell.column.getSize() }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
