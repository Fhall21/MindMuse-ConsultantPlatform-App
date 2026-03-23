"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const settingsSections = [
  {
    title: "General",
    href: "/settings",
  },
  {
    title: "Accessibility",
    href: "/settings/accessibility",
  },
  {
    title: "Billing",
    href: "/settings/billing",
  },
  {
    title: "AI Personalisation",
    description: "Tailor how the AI generates insights from your consultations.",
    href: "/settings/ai-personalisation",
  },
  {
    title: "Meeting Types",
    description: "Manage the types used to classify and code your meetings.",
    href: "/settings/meeting-types",
  },
  {
    title: "Integrations",
    href: "/settings/integrations",
  },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings sections"
      className="overflow-x-auto"
    >
      <ul className="flex min-w-max items-center gap-5 border-b border-border/80">
        {settingsSections.map((section) => {
          const isActive =
            section.href === "/settings"
              ? pathname === section.href
              : pathname.startsWith(section.href);

          return (
            <li key={section.href}>
              <Link
                href={section.href}
                className={cn(
                  "inline-flex border-b-2 px-0 py-2 text-sm font-medium tracking-tight transition-colors",
                  isActive
                    ? "border-foreground/70 text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                {section.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
