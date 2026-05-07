"use client";

import React, { ReactNode, useCallback, useId, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

interface TabsContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  baseId: string;
  registerTrigger: (value: string, node: HTMLButtonElement | null) => void;
  focusAdjacent: (currentValue: string, direction: 1 | -1 | "first" | "last") => void;
}

const TabsContext = React.createContext<TabsContextType | undefined>(undefined);

function useTabs() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("useTabs must be used within a Tabs component");
  }
  return context;
}

interface TabsProps {
  /** Uncontrolled initial value. Ignored when `value` is provided. */
  defaultValue?: string;
  /** Controlled active tab. */
  value?: string;
  /** Notifies the parent when the user changes the active tab. */
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

function Tabs({ defaultValue, value, onValueChange, children, className }: TabsProps) {
  const isControlled = value !== undefined;
  const [internalActive, setInternalActive] = React.useState(defaultValue ?? "");

  const activeTab = isControlled ? value : internalActive;

  const setActiveTab = useCallback(
    (next: string) => {
      if (!isControlled) {
        setInternalActive(next);
      }
      onValueChange?.(next);
    },
    [isControlled, onValueChange]
  );

  const baseId = useId();
  const triggersRef = useRef<Map<string, HTMLButtonElement>>(new Map());

  const registerTrigger = useCallback((triggerValue: string, node: HTMLButtonElement | null) => {
    if (node) {
      triggersRef.current.set(triggerValue, node);
    } else {
      triggersRef.current.delete(triggerValue);
    }
  }, []);

  const focusAdjacent = useCallback(
    (currentValue: string, direction: 1 | -1 | "first" | "last") => {
      const order = Array.from(triggersRef.current.keys());
      if (order.length === 0) return;
      let nextValue: string | undefined;
      if (direction === "first") {
        nextValue = order[0];
      } else if (direction === "last") {
        nextValue = order[order.length - 1];
      } else {
        const currentIndex = order.indexOf(currentValue);
        if (currentIndex === -1) return;
        const nextIndex = (currentIndex + direction + order.length) % order.length;
        nextValue = order[nextIndex];
      }
      if (!nextValue) return;
      const node = triggersRef.current.get(nextValue);
      if (node) {
        node.focus();
        setActiveTab(nextValue);
      }
    },
    [setActiveTab]
  );

  const contextValue = useMemo(
    () => ({ activeTab, setActiveTab, baseId, registerTrigger, focusAdjacent }),
    [activeTab, setActiveTab, baseId, registerTrigger, focusAdjacent]
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

interface TabsListProps {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}

function TabsList({ children, className, "aria-label": ariaLabel }: TabsListProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex items-center gap-5 border-b border-border/80 overflow-x-auto",
        className
      )}
    >
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  className?: string;
}

function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const { activeTab, setActiveTab, baseId, registerTrigger, focusAdjacent } = useTabs();
  const ref = useRef<HTMLButtonElement | null>(null);
  const isActive = activeTab === value;

  React.useEffect(() => {
    registerTrigger(value, ref.current);
    return () => registerTrigger(value, null);
  }, [registerTrigger, value]);

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      id={`${baseId}-trigger-${value}`}
      aria-selected={isActive}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={isActive ? 0 : -1}
      onClick={() => setActiveTab(value)}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          focusAdjacent(value, 1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          focusAdjacent(value, -1);
        } else if (event.key === "Home") {
          event.preventDefault();
          focusAdjacent(value, "first");
        } else if (event.key === "End") {
          event.preventDefault();
          focusAdjacent(value, "last");
        }
      }}
      className={cn(
        "border-b-2 px-0 py-2 text-sm font-medium tracking-tight transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isActive
          ? "border-foreground/70 text-foreground"
          : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

function TabsContent({ value, children, className }: TabsContentProps) {
  const { activeTab, baseId } = useTabs();

  if (activeTab !== value) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-trigger-${value}`}
      tabIndex={0}
      className={cn(
        "mt-6 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      {children}
    </div>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
