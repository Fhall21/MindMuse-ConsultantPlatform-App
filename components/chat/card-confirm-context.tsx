"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface CardConfirmContextValue {
  isPending: (key: string) => boolean;
  setPending: (key: string, pending: boolean) => void;
}

const CardConfirmContext = createContext<CardConfirmContextValue | null>(null);

export function CardConfirmProvider({ children }: { children: ReactNode }) {
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(() => new Set());

  const setPending = useCallback((key: string, pending: boolean) => {
    setPendingKeys((current) => {
      const next = new Set(current);
      if (pending) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  const isPending = useCallback((key: string) => pendingKeys.has(key), [pendingKeys]);

  const value = useMemo(() => ({ isPending, setPending }), [isPending, setPending]);

  return (
    <CardConfirmContext.Provider value={value}>{children}</CardConfirmContext.Provider>
  );
}

export function useCardConfirm() {
  const context = useContext(CardConfirmContext);
  if (!context) {
    throw new Error("useCardConfirm must be used within CardConfirmProvider");
  }
  return context;
}
