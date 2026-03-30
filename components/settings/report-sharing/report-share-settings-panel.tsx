"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useReportShareSettings, useUpdateReportShareSettings } from "@/hooks/use-report-shares";
import { formatDate } from "@/lib/report-formatting";

export function ReportShareSettingsPanel() {
  const { data: settings, isLoading } = useReportShareSettings();
  const updateMutation = useUpdateReportShareSettings();
  const [passcode, setPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");

  const helperText = useMemo(() => {
    if (!settings?.passcodeUpdatedAt) {
      return "Create a separate passcode used only for public report share links.";
    }

    return `Last updated ${formatDate(settings.passcodeUpdatedAt)}`;
  }, [settings?.passcodeUpdatedAt]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (passcode.length < 8) {
      toast.error("Use at least 8 characters for the share passcode.");
      return;
    }

    if (passcode !== confirmPasscode) {
      toast.error("Passcode confirmation does not match.");
      return;
    }

    try {
      await updateMutation.mutateAsync({ passcode });
      setPasscode("");
      setConfirmPasscode("");
      toast.success(settings?.hasPasscode ? "Share passcode updated." : "Share passcode created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save share passcode.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">Report Sharing</p>
          <p className="text-sm text-muted-foreground">{isLoading ? "Loading share settings…" : helperText}</p>
        </div>
        <Badge variant="outline">
          {settings?.hasPasscode ? "Passcode set" : "Passcode required"}
        </Badge>
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Share passcode</CardTitle>
          <CardDescription>
            Every stakeholder share link uses this passcode before the report is revealed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="report-share-passcode">Passcode</Label>
                <Input
                  id="report-share-passcode"
                  type="password"
                  value={passcode}
                  onChange={(event) => setPasscode(event.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  disabled={updateMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-share-passcode-confirm">Confirm passcode</Label>
                <Input
                  id="report-share-passcode-confirm"
                  type="password"
                  value={confirmPasscode}
                  onChange={(event) => setConfirmPasscode(event.target.value)}
                  placeholder="Repeat passcode"
                  autoComplete="new-password"
                  disabled={updateMutation.isPending}
                />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Keep this distinct from your account password so it can be rotated without affecting sign-in.
            </p>

            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending
                ? "Saving..."
                : settings?.hasPasscode
                  ? "Update Passcode"
                  : "Create Passcode"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}