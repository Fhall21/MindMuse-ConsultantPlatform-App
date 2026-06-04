"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CARD_REOPEN_HELP } from "@/lib/chat/onboarding-copy";
import type { CardSuccessLink } from "@/lib/chat/card-success-destinations";

const LINK_CLASS = "font-medium underline underline-offset-4";

export function CardSuccessLink({ href, label }: CardSuccessLink) {
  return (
    <Link href={href} className={LINK_CLASS}>
      {label}
    </Link>
  );
}

export function buildSuccessHelp(
  link: CardSuccessLink | null,
  options?: { includeReopenHelp?: boolean }
): ReactNode {
  const includeReopenHelp = options?.includeReopenHelp ?? true;
  if (!link && !includeReopenHelp) {
    return null;
  }
  if (!link) {
    return includeReopenHelp ? CARD_REOPEN_HELP : null;
  }
  return (
    <span className="block space-y-1">
      <CardSuccessLink href={link.href} label={link.label} />
      {includeReopenHelp ? (
        <span className="block text-xs leading-relaxed text-muted-foreground">
          {CARD_REOPEN_HELP}
        </span>
      ) : null}
    </span>
  );
}
