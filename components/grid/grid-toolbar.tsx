"use client";

import {
  ChevronDown,
  Download,
  Filter,
  Grid2X2,
  Plus,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface GridToolbarProps {
  onAddColumn: () => void;
  onExport?: () => void;
}

export function GridToolbar({ onAddColumn, onExport }: GridToolbarProps) {
  return (
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

      <Button type="button" variant="outline" size="sm" onClick={onAddColumn}>
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

      <Button type="button" variant="outline" size="sm" onClick={onExport}>
        <Download aria-hidden="true" />
        Export
      </Button>
    </div>
  );
}
