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
    title: "AI Personalisation",
    description: "Tailor how the AI generates insights from your consultations.",
    href: "/settings/ai-personalisation",
  },
  {
    title: "Report Template",
    description: "Customise the structure and style of generated reports.",
    href: "/settings/report-template",
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
    <nav
      aria-label="Settings sections"
      className="overflow-x-auto border-b border-border/80 pb-1"
    >
      <ul className="flex min-w-max items-center gap-5">
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
                  "inline-flex border-b-2 px-0 pb-3 text-sm font-medium tracking-tight transition-colors",
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
