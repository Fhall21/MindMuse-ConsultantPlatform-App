"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { fetchJson } from "@/hooks/api";
import type { Meeting, Person } from "@/types/db";

interface PersonSheetProps {
  personId: string;
  open: boolean;
  onClose: () => void;
}

interface PersonSheetData {
  person: Person;
  consultations: Pick<Meeting, "id" | "title" | "status" | "created_at">[];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function PersonSheet({ personId, open, onClose }: PersonSheetProps) {
  const sheetQuery = useQuery({
    queryKey: ["people", "sheet", personId],
    queryFn: () =>
      fetchJson<PersonSheetData>(`/api/client/people/${personId}`),
    enabled: open && !!personId,
  });

  const data = sheetQuery.data;

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{data?.person.name ?? "Person details"}</SheetTitle>
          <SheetDescription>
            Review person details and linked consultations.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6">
          {sheetQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading person details...</p>
          ) : null}

          {sheetQuery.isError ? (
            <p className="text-sm text-destructive">Unable to load this person right now.</p>
          ) : null}

          {data ? (
            <>
              <section className="space-y-2">
                <h3 className="text-sm font-medium">Details</h3>
                <dl className="space-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">Name:</dt>
                    <dd>{data.person.name}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">Working group:</dt>
                    <dd>{data.person.working_group || "-"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">Work type:</dt>
                    <dd>{data.person.work_type || "-"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">Role:</dt>
                    <dd>{data.person.role || "-"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">Email:</dt>
                    <dd>{data.person.email || "-"}</dd>
                  </div>
                </dl>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-medium">Linked Consultations</h3>
                {data.consultations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No linked consultations.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.consultations.map((consultation) => (
                      <li key={consultation.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            href={`/meetings/${consultation.id}`}
                            className="font-medium hover:underline"
                          >
                            {consultation.title}
                          </Link>
                          {consultation.status === "complete" ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                              Complete
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Draft</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(consultation.created_at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
