"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { readClarificationQuestions, type ChatCardProps } from "./types";

export function ClarificationQuestionCard({ tool }: ChatCardProps) {
  const questions = readClarificationQuestions(tool.output);

  if (questions.length === 0) {
    return null;
  }

  return (
    <Card size="sm" className="max-w-2xl">
      <CardHeader className="border-b">
        <CardTitle>Clarification needed</CardTitle>
        <CardDescription>
          These notes look ambiguous. Consider answering before continuing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {questions.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border border-border/70 bg-muted/20 px-3 py-3"
          >
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {item.field.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="text-sm leading-relaxed text-foreground">{item.question}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
