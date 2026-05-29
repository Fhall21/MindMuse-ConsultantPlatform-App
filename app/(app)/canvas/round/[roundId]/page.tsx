import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CanvasWorkspaceShell } from "@/components/canvas/canvas-workspace-shell";
import { requireCurrentUserId } from "@/lib/data/auth-context";
import { getConsultationForUser } from "@/lib/data/domain-read";

interface CanvasRoundPageProps {
  params: Promise<{ roundId: string }>;
}

/**
 * Evidence canvas workspace route (round-scoped).
 *
 * Route: /canvas/round/[roundId]
 */
export default async function CanvasRoundPage({ params }: CanvasRoundPageProps) {
  const { roundId } = await params;

  const userId = await requireCurrentUserId();
  const consultation = await getConsultationForUser(roundId, userId);
  if (!consultation) notFound();

  return (
    <Suspense>
      <CanvasWorkspaceShell roundId={roundId} roundLabel={consultation.label} />
    </Suspense>
  );
}
