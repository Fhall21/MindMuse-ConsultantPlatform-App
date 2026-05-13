"use client";

import { cn } from "@/lib/utils";
import type { ReferenceStrength } from "@/hooks/use-research";

interface StrengthBadgeProps {
  strength: ReferenceStrength;
}

const TONE: Record<
  ReferenceStrength,
  { className: string; label: string; aria: string }
> = {
  DOMAIN_LEADING: {
    className: "bg-strength-domain text-strength-domain-foreground",
    label: "Domain leading",
    aria: "Domain leading peer-reviewed journal",
  },
  PEER_REVIEWED: {
    className: "bg-strength-peer text-strength-peer-foreground",
    label: "Peer reviewed",
    aria: "Peer-reviewed journal",
  },
  HIGHEST_QUALITY: {
    className: "bg-strength-quality text-strength-quality-foreground",
    label: "Highest quality",
    aria: "Highest-quality peer-reviewed journal",
  },
};

// Intentionally rectangular (rounded-[3px]), NOT a pill — round pills on
// these badges read as AI slop.
export function ReferenceStrengthBadge({ strength }: StrengthBadgeProps) {
  const tone = TONE[strength];
  return (
    <span
      aria-label={tone.aria}
      className={cn(
        "inline-flex items-center rounded-[3px] px-1.5 py-0.5",
        "font-mono text-[10px] font-semibold uppercase tracking-wider",
        tone.className
      )}
    >
      {tone.label}
    </span>
  );
}
