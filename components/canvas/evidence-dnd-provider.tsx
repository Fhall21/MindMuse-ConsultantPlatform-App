"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ResearchInsightLibraryEntry } from "@/hooks/use-research-extraction";

export const EVIDENCE_INSIGHT_MIME = "application/x-evidence-insight";
export const REACTFLOW_INSIGHT_MIME = "application/reactflow";

interface EvidenceDnDContextValue {
  draggedInsightId: string | null;
  dragPayload: ResearchInsightLibraryEntry | null;
  setDragPayload: (item: ResearchInsightLibraryEntry | null) => void;
  clearDrag: () => void;
}

const EvidenceDnDContext = createContext<EvidenceDnDContextValue | null>(null);

export function EvidenceDnDProvider({ children }: { children: ReactNode }) {
  const [dragPayload, setDragPayloadState] =
    useState<ResearchInsightLibraryEntry | null>(null);

  const setDragPayload = useCallback((item: ResearchInsightLibraryEntry | null) => {
    setDragPayloadState(item);
  }, []);

  const clearDrag = useCallback(() => {
    setDragPayloadState(null);
  }, []);

  const value = useMemo<EvidenceDnDContextValue>(
    () => ({
      draggedInsightId: dragPayload?.insightId ?? null,
      dragPayload,
      setDragPayload,
      clearDrag,
    }),
    [clearDrag, dragPayload, setDragPayload]
  );

  return (
    <EvidenceDnDContext.Provider value={value}>{children}</EvidenceDnDContext.Provider>
  );
}

export function useEvidenceDnD() {
  const ctx = useContext(EvidenceDnDContext);
  if (!ctx) {
    throw new Error("useEvidenceDnD must be used within EvidenceDnDProvider");
  }
  return ctx;
}

export function useEvidenceDnDOptional() {
  return useContext(EvidenceDnDContext);
}
