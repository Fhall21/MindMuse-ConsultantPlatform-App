"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const consultationSections = [
  { title: "Meetings", href: "/meetings" },
  { title: "Digital Interviews", href: "/digital-interviews" },
  { title: "Projects", href: "/consultations" },
];

export function ConsultationsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Project sections"
      className="overflow-x-auto"
    >
      <ul className="flex min-w-max items-center gap-5 border-b border-border/80">
        {consultationSections.map((section) => {
          const isActive =
            section.href === "/meetings"
              ? pathname === section.href || pathname.startsWith("/meetings/")
              : section.href === "/digital-interviews"
                ? pathname.startsWith("/digital-interviews")
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
