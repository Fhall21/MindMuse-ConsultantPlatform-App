import { Button } from "@/components/ui/button";

export default function PeoplePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">People</h1>
        <Button>Add Person</Button>
      </div>
      <p className="text-muted-foreground">
        No people added yet. People linked to consultations will appear here.
      </p>
    </div>
  );
}
