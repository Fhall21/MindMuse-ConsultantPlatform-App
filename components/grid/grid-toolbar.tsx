"use client";

import { useState } from "react";
import {
  CheckCheck,
  ChevronDown,
  Download,
  Filter,
  Grid2X2,
  Loader2,
  Plus,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BulkAcceptDialog } from "@/components/grid/bulk-accept-dialog";

interface GridToolbarProps {
  onAddColumn: () => void;
  addColumnDisabled?: boolean;
  onExport?: () => void;
  exportLoading?: boolean;
  bulkActions?: {
    roundId: string;
    completedCellIds: ReadonlySet<string>;
  };
}

export function GridToolbar({
  onAddColumn,
  addColumnDisabled = false,
  onExport,
  exportLoading = false,
  bulkActions,
}: GridToolbarProps) {
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  return (
    <>
      <div
        className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b bg-background px-3 py-2"
        aria-label="Analysis grid toolbar"
      >
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          toast.info("Coming soon", {
            description: "Alternative grid layouts are under development.",
          })
        }
      >
        <Grid2X2 aria-hidden="true" />
        Basic grid
        <ChevronDown aria-hidden="true" className="ml-1 size-3.5 text-muted-foreground" />
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          toast.info("Coming soon", {
            description:
              "Row grouping by people, sites, and segments is under development.",
          })
        }
      >
        Rows: Meetings
        <ChevronDown aria-hidden="true" className="ml-1 size-3.5 text-muted-foreground" />
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          toast.info("Coming soon", {
            description: "Grid filtering is under development.",
          })
        }
      >
        <Filter aria-hidden="true" />
        Filter view
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAddColumn}
        disabled={addColumnDisabled}
      >
        <Plus aria-hidden="true" />
        Add column
      </Button>

      <div className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          toast.info("Coming soon", {
            description: "Group comparison is under development.",
          })
        }
      >
        <UsersRound aria-hidden="true" />
        Compare groups
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onExport}
        disabled={exportLoading}
      >
        {exportLoading ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <Download aria-hidden="true" />
        )}
        Export
      </Button>

        {bulkActions ? (
          <>
            <div
              className="mx-1 hidden h-6 w-px bg-border sm:block"
              aria-hidden="true"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBulkDialogOpen(true)}
            >
              <CheckCheck aria-hidden="true" />
              Accept reviewed
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setBulkDialogOpen(true)}
            >
              <CheckCheck aria-hidden="true" />
              Accept all visible
            </Button>
          </>
        ) : null}
      </div>

      {bulkActions ? (
        <BulkAcceptDialog
          roundId={bulkActions.roundId}
          completedCellIds={bulkActions.completedCellIds}
          open={bulkDialogOpen}
          onOpenChange={setBulkDialogOpen}
        />
      ) : null}
    </>
  );
}
