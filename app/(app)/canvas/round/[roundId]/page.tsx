import { notFound } from "next/navigation";
import Link from "next/link";
import { CanvasShell } from "@/components/canvas/canvas-shell";
import { requireCurrentUserId } from "@/lib/data/auth-context";
import { getConsultationForUser } from "@/lib/data/domain-read";

interface CanvasRoundPageProps {
  params: Promise<{ roundId: string }>;
}

/**
 * Evidence network canvas route (round-scoped).
 *
 * Route: /canvas/round/[roundId]
 */
export default async function CanvasRoundPage({ params }: CanvasRoundPageProps) {
  const { roundId } = await params;

  const userId = await requireCurrentUserId();
  const consultation = await getConsultationForUser(roundId, userId);
  if (!consultation) notFound();

  return (
    <div className="-mx-4 -my-5 flex h-[calc(100vh-3rem)] flex-col overflow-hidden sm:-mx-6">
      {/* Breadcrumb header */}
      <header className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
        <Link
          href="/consultations/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Consultations
        </Link>
        <span className="text-sm text-muted-foreground">/</span>
        <Link
          href={`/consultations/${roundId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {consultation.label}
        </Link>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">Canvas</span>
      </header>

      {/* Canvas workspace — fills remaining height */}
      <div className="flex-1 overflow-hidden">
        <CanvasShell roundId={roundId} roundLabel={consultation.label} />
      </div>
    </div>
  );
}
