import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ClarificationQuestionItemProps {
  field: string;
  question: string;
  className?: string;
}

function formatFieldLabel(field: string) {
  return field.replace(/_/g, " ");
}

export function ClarificationQuestionItem({
  field,
  question,
  className,
}: ClarificationQuestionItemProps) {
  return (
    <div className={cn("space-y-3 rounded-xl border border-border/70 bg-card p-4", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="capitalize">
          {formatFieldLabel(field)}
        </Badge>
      </div>
      <p className="text-sm font-medium leading-snug text-foreground">{question}</p>
    </div>
  );
}
