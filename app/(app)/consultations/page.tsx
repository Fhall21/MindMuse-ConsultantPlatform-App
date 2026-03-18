import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ConsultationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Consultations</h1>
        <Button asChild>
          <Link href="/consultations/new">New Consultation</Link>
        </Button>
      </div>
      <p className="text-muted-foreground">
        No consultations yet. Create your first consultation to get started.
      </p>
    </div>
  );
}
