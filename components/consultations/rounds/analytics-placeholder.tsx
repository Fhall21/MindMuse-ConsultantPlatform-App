"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AnalyticsPlaceholder() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Analytics</CardTitle>
        <CardDescription>
          Round analytics will appear here in a future release.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex h-32 items-center justify-center rounded-md border border-dashed">
          <p className="text-sm text-muted-foreground">Coming soon</p>
        </div>
      </CardContent>
    </Card>
  );
}
