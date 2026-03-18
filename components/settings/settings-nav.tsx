"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const settingsSections = [
  {
    title: "General",
    description: "Account profile, email, and password updates.",
    href: "/settings",
  },
  {
    title: "Accessibility",
    description: "Improve readability, motion, and focus visibility.",
    href: "/settings/accessibility",
  },
  {
    title: "Billing",
    description: "Subscription, pricing, and future billing tools.",
    href: "/settings/billing",
  },
  {
    title: "Integrations",
    description: "Connections to your external tools and workflows.",
    href: "/settings/integrations",
  },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings sections" className="rounded-xl border bg-card p-2 shadow-xs">
      <ul className="space-y-1">
        {settingsSections.map((section) => {
          const isActive =
            section.href === "/settings" ? pathname === section.href : pathname.startsWith(section.href);

          return (
            <li key={section.href}>
              <Link
                href={section.href}
                className={cn(
                  "block rounded-lg px-3 py-3 transition-colors",
                  isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <p className="font-medium">{section.title}</p>
                <p className="mt-1 text-xs leading-relaxed">{section.description}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
