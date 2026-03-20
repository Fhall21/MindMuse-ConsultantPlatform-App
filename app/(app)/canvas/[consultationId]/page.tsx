import { notFound } from "next/navigation";
import Link from "next/link";
import { CanvasShell } from "@/components/canvas/canvas-shell";

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
 *
 * TODO (Agent 2): replace the stub fetch below with a real Postgres query
 * once the canvas_layouts and canvas_edges tables exist.
 */
export default async function CanvasPage({ params }: CanvasPageProps) {
  const { consultationId } = await params;

  // TODO: replace with real fetch — stubbed until schema lands
  const consultation = await fetchConsultationStub(consultationId);
  if (!consultation) notFound();

  return (
    <div className="flex h-screen flex-col">
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

// ---------------------------------------------------------------------------
// Stub — remove when real DB query is implemented
// ---------------------------------------------------------------------------

async function fetchConsultationStub(
  id: string
): Promise<{ title: string } | null> {
  // Stub returns a valid object for any non-empty id.
  // Replaced by: db.select().from(consultations).where(eq(consultations.id, id))
  if (!id) return null;
  return { title: `Consultation ${id.slice(0, 8)}` };
}
