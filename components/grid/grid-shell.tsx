"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MousePointerSquareDashed, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ColumnAddDialog } from "@/components/grid/column-add-dialog";
import { GridToolbar } from "@/components/grid/grid-toolbar";

export interface GridShellColumn {
  id: string;
  question: string;
  position: number;
}

interface GridShellProps {
  roundId: string;
  columns: GridShellColumn[];
  isLoading?: boolean;
  matrix?: ReactNode;
  matrixOwnsHeaders?: boolean;
  evidencePanel?: ReactNode;
  onAddColumn?: (question: string) => void | Promise<void>;
  onExport?: () => void;
}

export function reorderGridColumns(
  columns: GridShellColumn[],
  activeId: string,
  overId: string
) {
  const oldIndex = columns.findIndex((column) => column.id === activeId);
  const newIndex = columns.findIndex((column) => column.id === overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return columns;

  return arrayMove(columns, oldIndex, newIndex).map((column, position) => ({
    ...column,
    position,
  }));
}

export async function persistGridColumnOrder(
  roundId: string,
  previousColumns: GridShellColumn[],
  nextColumns: GridShellColumn[]
) {
  const changedColumns = nextColumns.filter(
    (column) =>
      previousColumns.find((previous) => previous.id === column.id)?.position !==
      column.position
  );

  await Promise.all(
    changedColumns.map(async (column) => {
      const response = await fetch(
        `/api/client/consultations/${roundId}/grid/columns/${column.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: column.position }),
        }
      );
      if (!response.ok) throw new Error("Failed to reorder analysis columns");
    })
  );
}

function SortableColumnHeader({
  column,
  index,
}: {
  column: GridShellColumn;
  index: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex h-16 w-72 shrink-0 items-center gap-2 border-r bg-background px-3",
        isDragging && "z-10 opacity-70 shadow-md"
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        aria-label={`Reorder column ${index + 1}: ${column.question}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>
      <span className="line-clamp-2 text-sm font-medium leading-5">
        {index + 1}. {column.question}
      </span>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="min-w-[54rem]" aria-label="Loading analysis grid">
      <div className="flex h-16 border-b">
        <div className="w-44 shrink-0 border-r p-4">
          <Skeleton className="h-4 w-20" />
        </div>
        {[0, 1, 2].map((column) => (
          <div key={column} className="w-72 shrink-0 border-r p-4">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="mt-2 h-3 w-3/5" />
          </div>
        ))}
      </div>
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex min-h-28 border-b">
          <div className="w-44 shrink-0 border-r p-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-2 h-3 w-20" />
          </div>
          {[0, 1, 2].map((column) => (
            <div key={column} className="w-72 shrink-0 border-r p-4">
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="mt-2 h-4 w-4/5" />
              <Skeleton className="mt-4 h-3 w-16" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyGrid({ onAddColumn }: { onAddColumn: () => void }) {
  return (
    <div className="flex min-h-80 flex-1 items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 grid size-10 place-items-center rounded-full border bg-muted/40">
          <Plus className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <h2 className="text-base font-semibold">No analysis questions yet</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Add a column to get started.
        </p>
        <Button type="button" variant="outline" className="mt-5" onClick={onAddColumn}>
          <Plus aria-hidden="true" />
          Add column
        </Button>
      </div>
    </div>
  );
}

function EvidencePlaceholder() {
  return (
    <div className="flex h-full min-h-56 items-center justify-center p-8 text-center">
      <div className="max-w-64">
        <MousePointerSquareDashed
          className="mx-auto size-5 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="mt-3 text-sm font-medium">Select an insight</p>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          Choose an insight in the grid to review its supporting evidence.
        </p>
      </div>
    </div>
  );
}

export function GridShell({
  roundId,
  columns,
  isLoading = false,
  matrix,
  matrixOwnsHeaders = false,
  evidencePanel,
  onAddColumn,
  onExport,
}: GridShellProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [optimisticOrder, setOptimisticOrder] = useState<string[] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const orderedColumns = useMemo(() => {
    const sortedColumns = [...columns].sort((a, b) => a.position - b.position);
    if (!optimisticOrder) return sortedColumns;

    const orderById = new Map(optimisticOrder.map((id, index) => [id, index]));
    return sortedColumns
      .sort(
        (left, right) =>
          (orderById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (orderById.get(right.id) ?? Number.MAX_SAFE_INTEGER)
      )
      .map((column, position) => ({ ...column, position }));
  }, [columns, optimisticOrder]);
  const columnIds = useMemo(
    () => orderedColumns.map((column) => column.id),
    [orderedColumns]
  );

  async function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;

    const previousColumns = orderedColumns;
    const nextColumns = reorderGridColumns(previousColumns, activeId, overId);
    if (nextColumns === previousColumns) return;

    setOptimisticOrder(nextColumns.map((column) => column.id));
    try {
      await persistGridColumnOrder(roundId, previousColumns, nextColumns);
    } catch {
      setOptimisticOrder(previousColumns.map((column) => column.id));
      toast.error("Could not reorder columns. Try again.");
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-background" aria-label="Analysis grid">
      <GridToolbar
        onAddColumn={() => setIsAddDialogOpen(true)}
        onExport={onExport}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto xl:grid-cols-[minmax(0,7fr)_minmax(18rem,3fr)] xl:overflow-hidden">
        <div className="flex min-h-[28rem] min-w-0 flex-col overflow-x-auto xl:min-h-0">
          {isLoading ? (
            <GridSkeleton />
          ) : orderedColumns.length === 0 ? (
            <EmptyGrid onAddColumn={() => setIsAddDialogOpen(true)} />
          ) : (
            <DndContext
              id={`analysis-grid-${roundId}`}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={columnIds}
                strategy={horizontalListSortingStrategy}
              >
                {matrixOwnsHeaders && matrix ? (
                  matrix
                ) : (
                  <div className="min-w-max">
                    <div className="flex border-b">
                      <div className="flex h-16 w-44 shrink-0 items-center border-r px-3 text-sm font-medium">
                        Meeting
                      </div>
                      {orderedColumns.map((column, index) => (
                        <SortableColumnHeader
                          key={column.id}
                          column={column}
                          index={index}
                        />
                      ))}
                    </div>
                    {matrix ?? (
                      <div className="grid min-h-72 place-items-center text-sm text-muted-foreground">
                        Meeting evidence will appear here.
                      </div>
                    )}
                  </div>
                )}
              </SortableContext>
            </DndContext>
          )}
        </div>

        <aside
          className="min-h-56 border-t bg-card xl:min-h-0 xl:border-t-0 xl:border-l"
          aria-label="Evidence panel"
        >
          {evidencePanel ?? <EvidencePlaceholder />}
        </aside>
      </div>

      <ColumnAddDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAddColumn={onAddColumn}
      />
    </section>
  );
}
