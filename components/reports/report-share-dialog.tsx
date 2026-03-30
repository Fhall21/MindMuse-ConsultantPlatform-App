"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateReportShareLink,
  useReportShareLinks,
  useReportShareSettings,
  useRevokeReportShareLink,
} from "@/hooks/use-report-shares";
import { formatDate } from "@/lib/report-formatting";

interface ReportShareDialogProps {
  artifactId: string;
}

async function copyToClipboard(value: string) {
  await navigator.clipboard.writeText(value);
}

export function ReportShareDialog({ artifactId }: ReportShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [consultantName, setConsultantName] = useState("");
  const [consultantEmail, setConsultantEmail] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("14");
  const settingsQuery = useReportShareSettings();
  const linksQuery = useReportShareLinks(artifactId);
  const createMutation = useCreateReportShareLink(artifactId);
  const revokeMutation = useRevokeReportShareLink(artifactId);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const link = await createMutation.mutateAsync({
        consultantName: consultantName.trim() || null,
        consultantEmail: consultantEmail.trim(),
        expiresInDays: Number(expiresInDays),
      });

      setConsultantName("");
      setConsultantEmail("");
      setExpiresInDays("14");

      try {
        await copyToClipboard(link.shareUrl);
        toast.success("Share link created and copied.");
      } catch {
        toast.success("Share link created.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create share link.");
    }
  }

  async function handleRevoke(shareId: string) {
    try {
      await revokeMutation.mutateAsync(shareId);
      toast.success("Share link revoked.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke share link.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Share link</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Stakeholder share link</DialogTitle>
          <DialogDescription>
            Generate a public link for a single stakeholder. The recipient must enter your report share passcode before the report is shown.
          </DialogDescription>
        </DialogHeader>

        {settingsQuery.data?.hasPasscode ? (
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="share-consultant-name">Stakeholder name</Label>
                <Input
                  id="share-consultant-name"
                  value={consultantName}
                  onChange={(event) => setConsultantName(event.target.value)}
                  placeholder="Optional"
                  disabled={createMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="share-consultant-email">Stakeholder email</Label>
                <Input
                  id="share-consultant-email"
                  type="email"
                  value={consultantEmail}
                  onChange={(event) => setConsultantEmail(event.target.value)}
                  placeholder="name@example.com"
                  disabled={createMutation.isPending}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="share-expiry">Expires after</Label>
              <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                <SelectTrigger id="share-expiry">
                  <SelectValue placeholder="Choose expiry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create share link"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="rounded-lg border border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
            Set a report share passcode before generating public links.
            <span className="block pt-2">
              <Link href="/settings/report-sharing" className="underline underline-offset-4 hover:text-foreground">
                Open report sharing settings
              </Link>
            </span>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Existing links</h3>
            {linksQuery.isLoading ? <span className="text-xs text-muted-foreground">Loading…</span> : null}
          </div>

          <div className="space-y-2">
            {linksQuery.data && linksQuery.data.length > 0 ? (
              linksQuery.data.map((link) => (
                <div key={link.id} className="rounded-lg border border-border/60 bg-muted/5 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">
                          {link.consultantName || link.consultantEmail}
                        </p>
                        <Badge variant={link.status === "active" ? "secondary" : "outline"}>
                          {link.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{link.consultantEmail}</p>
                      <p className="break-all text-xs text-muted-foreground">{link.shareUrl}</p>
                      <p className="text-xs text-muted-foreground">
                        Expires {formatDate(link.expiresAt)} · {link.viewCount} view{link.viewCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void copyToClipboard(link.shareUrl)
                            .then(() => toast.success("Share link copied."))
                            .catch(() => toast.error("Failed to copy share link."));
                        }}
                      >
                        Copy link
                      </Button>
                      {link.status !== "revoked" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleRevoke(link.id)}
                          disabled={revokeMutation.isPending}
                        >
                          Revoke
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                No share links created for this report yet.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}