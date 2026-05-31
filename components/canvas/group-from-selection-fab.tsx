"use client";

import { useEffect, useState } from "react";
import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface GroupFromSelectionFabProps {
  nodeCount: number;
  onCreateGroup: () => void;
}

export function GroupFromSelectionFab({ nodeCount, onCreateGroup }: GroupFromSelectionFabProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div
      className={
        reducedMotion
          ? "absolute bottom-6 right-6 z-30"
          : "absolute bottom-6 right-6 z-30 animate-in slide-in-from-bottom-2 duration-200"
      }
    >
      <Button
        onClick={onCreateGroup}
        className="gap-2 shadow-lg"
        size="sm"
      >
        <FolderPlus className="h-4 w-4" />
        Create Group from Selection
        <Badge variant="secondary" className="ml-1">
          {nodeCount}
        </Badge>
      </Button>
    </div>
  );
}
