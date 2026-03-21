"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const consultationSections = [
  { title: "Meetings", href: "/meetings" },
  { title: "Consultations", href: "/consultations" },
];

export function ConsultationsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Consultation sections"
      className="overflow-x-auto"
    >
      <ul className="flex min-w-max items-center gap-5 border-b border-border/80">
        {consultationSections.map((section) => {
          const isActive =
            section.href === "/meetings"
              ? pathname === section.href || pathname.startsWith("/meetings/")
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
