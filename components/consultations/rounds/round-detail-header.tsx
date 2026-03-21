"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { RoundDetail } from "@/types/round-detail";

interface RoundDetailHeaderProps {
  round: RoundDetail["round"];
}

export function RoundDetailHeader({ round }: RoundDetailHeaderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/consultations/"
          className="hover:text-foreground transition-colors"
        >
          Rounds
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{round.label}</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{round.label}</h1>
          {round.description ? (
            <p className="text-sm text-muted-foreground">{round.description}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary">
            {round.linkedConsultationCount} consultation
            {round.linkedConsultationCount !== 1 ? "s" : ""}
          </Badge>
        </div>
      </div>
    </div>
  );
}
