"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConsultationsNav } from "@/components/consultations/consultations-nav";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDigitalInterviews } from "@/hooks/use-digital-interviews";
import { formatDigitalInterviewFramework } from "@/lib/digital-interviews";
import type { DigitalInterviewFlowListItem } from "@/lib/data/digital-interviews";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatStatus(status: DigitalInterviewFlowListItem["status"]) {
  if (status === "active") {
    return <Badge variant="default">Active</Badge>;
  }

  if (status === "closed") {
    return <Badge variant="outline">Closed</Badge>;
  }

  return <Badge variant="secondary">Draft</Badge>;
}

export default function DigitalInterviewsPage() {
  const router = useRouter();
  const { data: flows = [], isLoading, error } = useDigitalInterviews();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Digital Interviews</h1>
      </div>

      <ConsultationsNav />

      <Card className="border-border/70 shadow-xs">
        <CardHeader>
          <div>
            <CardTitle>Find digital interviews</CardTitle>
            <CardDescription>
              Use async interviews when participants are dispersed, you need the same prompts across
              a larger group, or live scheduling is hard.
            </CardDescription>
          </div>
          <CardAction>
            <Button asChild>
              <Link href="/digital-interviews/new">Create Digital Interview</Link>
            </Button>
          </CardAction>
        </CardHeader>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : error ? (
        <div className="space-y-3 border-t border-border/80 pt-4">
          <p className="text-sm text-destructive">Failed to load digital interviews.</p>
          <Button asChild>
            <Link href="/digital-interviews/new">Create Digital Interview</Link>
          </Button>
        </div>
      ) : flows.length === 0 ? (
        <div className="space-y-3 border-t border-border/80 pt-4">
          <p className="text-sm text-muted-foreground">No digital interviews yet.</p>
          <Button asChild>
            <Link href="/digital-interviews/new">Create Digital Interview</Link>
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Framework</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Responses</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flows.map((flow) => (
              <TableRow
                key={flow.id}
                className="cursor-pointer transition-colors hover:bg-muted/40"
                onClick={() => router.push(`/digital-interviews/${flow.id}`)}
              >
                <TableCell>
                  <Link
                    href={`/digital-interviews/${flow.id}`}
                    className="font-medium hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {flow.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {formatDigitalInterviewFramework(flow.framework)}
                  </span>
                </TableCell>
                <TableCell>{formatStatus(flow.status)}</TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {flow.completed_count} response{flow.completed_count === 1 ? "" : "s"}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">{formatDate(flow.created_at)}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}