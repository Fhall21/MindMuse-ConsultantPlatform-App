import { RoundsManager } from "@/components/consultations/rounds/rounds-manager";

export default function ConsultationRoundsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Consultation Rounds</h1>
        <p className="text-sm text-muted-foreground">
          Create and manage round labels used when filing consultations.
        </p>
      </div>

      <RoundsManager />
    </div>
  );
}
