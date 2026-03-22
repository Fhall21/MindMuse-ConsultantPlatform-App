"use client";

import type { RoundOutputSummary } from "@/lib/actions/consultation-workflow";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface RoundOutputCardProps {
  label: string;
  description: string;
  output: RoundOutputSummary | null;
  emptyMessage?: string;
}

function formatAbsoluteDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function RoundOutputCard({
  label,
  description,
  output,
  emptyMessage = "This consultation output has not been generated yet.",
}: RoundOutputCardProps) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <div>
          <CardTitle>{label}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {output ? (
          <CardAction>
            <Badge variant="outline">{output.status}</Badge>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-3">
        {output ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Generated {formatAbsoluteDate(output.generatedAt)}</span>
              {output.title ? <span>{output.title}</span> : null}
            </div>
            <div className="rounded-md border border-border/70 bg-muted/10 p-3">
              <pre className="whitespace-pre-wrap text-sm text-foreground">
                {output.content}
              </pre>
            </div>
          </>
        ) : (
          <p className="rounded-md border border-dashed border-border/70 bg-muted/10 p-3 text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
