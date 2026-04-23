import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NewDigitalInterviewPage() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Digital Interviews</h1>
        <p className="text-sm text-muted-foreground">Coming soon.</p>
      </div>
      <Button asChild variant="outline">
        <Link href="/digital-interviews">Back to digital interviews</Link>
      </Button>
    </div>
  );
}
