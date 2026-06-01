"use client";

import type { ReactNode } from "react";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ChatToolCardShellProps {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  error?: string | null;
  onDismiss?: () => void;
  dismissLabel?: string;
  dismissDisabled?: boolean;
  success?: boolean;
  successHelp?: ReactNode;
  dismissed?: boolean;
  maxWidth?: "xl" | "2xl" | "5xl";
  className?: string;
}

export function ChatToolCardShell({
  title,
  description,
  children,
  footer,
  error,
  onDismiss,
  dismissLabel = "Dismiss card",
  dismissDisabled = false,
  success = false,
  successHelp,
  dismissed = false,
  maxWidth = "xl",
  className,
}: ChatToolCardShellProps) {
  if (success) {
    return (
      <Card size="sm" className={cn("border-emerald-500/30 bg-emerald-500/5", className)}>
        <CardHeader>
          <div className="flex items-start gap-3">
            <CheckCircle2
              className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
            <div className="min-w-0 space-y-1">
              <CardTitle>{title}</CardTitle>
              {description ? <CardDescription>{description}</CardDescription> : null}
              {successHelp ? (
                <p className="pt-1 text-xs leading-relaxed text-muted-foreground">{successHelp}</p>
              ) : null}
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  if (dismissed) {
    return (
      <Card size="sm" className={cn("border-border/60 bg-muted/20", className)}>
        <CardHeader>
          <CardTitle className="text-muted-foreground">{title}</CardTitle>
          {description ? (
            <CardDescription className="text-muted-foreground">{description}</CardDescription>
          ) : null}
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card
      size="sm"
      className={cn(
        maxWidth === "5xl" ? "max-w-5xl" : maxWidth === "2xl" ? "max-w-2xl" : "max-w-xl",
        error ? "border-destructive/40 bg-destructive/5" : null,
        className,
      )}
    >
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
            {error ? <p className="text-sm text-destructive/80 mt-1">{error}</p> : null}
          </div>
          {onDismiss ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={dismissLabel}
              onClick={onDismiss}
              disabled={dismissDisabled}
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
      </CardHeader>

      {children ? (
        <CardContent className="space-y-3 pt-4">{children}</CardContent>
      ) : null}

      {footer ? (
        <CardFooter className="justify-end gap-2 border-t">{footer}</CardFooter>
      ) : null}
    </Card>
  );
}
