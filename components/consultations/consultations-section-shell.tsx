"use client";

import { usePathname } from "next/navigation";
import { ConsultationsNav } from "@/components/consultations/consultations-nav";

const consultationNavPaths = new Set(["/consultations", "/consultations/rounds"]);

export function ConsultationsSectionShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (!consultationNavPaths.has(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Consultations</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Work across active consultations and round structures from one clean section of the
          workspace.
        </p>
      </div>

      <ConsultationsNav />

      <div className="space-y-6">{children}</div>
    </div>
  );
}
