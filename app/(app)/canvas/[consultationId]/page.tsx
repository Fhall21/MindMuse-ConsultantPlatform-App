import { notFound } from "next/navigation";
import Link from "next/link";
import { CanvasShell } from "@/components/canvas/canvas-shell";
import { requireCurrentUserId } from "@/lib/data/auth-context";
import { getConsultationForUser } from "@/lib/data/domain-read";

interface CanvasPageProps {
  params: Promise<{ consultationId: string }>;
}

/**
 * Evidence network canvas route.
 *
 * Route: /canvas/[consultationId]
 *
 * This page is the primary canvas workspace. It wraps CanvasShell with
 * server-side consultation metadata fetch and auth guard.
 */
export default async function CanvasPage({ params }: CanvasPageProps) {
  const { consultationId } = await params;

  const userId = await requireCurrentUserId();
  const consultation = await getConsultationForUser(consultationId, userId);
  if (!consultation) notFound();

  return (
    <div className="-mx-4 -my-5 flex h-[calc(100vh-3rem)] flex-col overflow-hidden sm:-mx-6">
      {/* Breadcrumb header */}
      <header className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
        <Link
          href="/consultations"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Consultations
        </Link>
        <span className="text-sm text-muted-foreground">/</span>
        <Link
          href={`/consultations/${consultationId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {consultation.title}
        </Link>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">Canvas</span>
      </header>

      {/* Canvas workspace — fills remaining height */}
      <div className="flex-1 overflow-hidden">
        <CanvasShell
          consultationId={consultationId}
          consultationTitle={consultation.title}
        />
      </div>
    </div>
  );
}
