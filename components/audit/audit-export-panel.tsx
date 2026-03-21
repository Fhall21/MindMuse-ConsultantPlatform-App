"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useConsultations } from "@/hooks/use-consultations";
import { useAuditExport, useAuditExportUsers } from "@/hooks/use-audit-export";
import type { AuditExportFormat, AuditExportFilters } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SELECT_CLASS_NAME =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error) {
    return error;
  }

  return "Export failed. Please retry.";
}

export function AuditExportPanel() {
  const consultationsQuery = useConsultations();
  const usersQuery = useAuditExportUsers();
  const { exportAudit, isPending, error, lastExport, reset } = useAuditExport();

  const [filters, setFilters] = useState<Required<AuditExportFilters>>({
    dateFrom: null,
    dateTo: null,
    consultationId: null,
    userId: null,
  });

  const consultations = useMemo(() => consultationsQuery.data ?? [], [consultationsQuery.data]);
  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);

  const selectedConsultation = useMemo(
    () => consultations.find((consultation) => consultation.id === filters.consultationId) ?? null,
    [consultations, filters.consultationId]
  );
  const selectedUser = useMemo(
    () => users.find((user) => user.id === filters.userId) ?? null,
    [users, filters.userId]
  );

  const hasActiveFilters = Boolean(
    filters.dateFrom || filters.dateTo || filters.consultationId || filters.userId
  );

  async function handleExport(format: AuditExportFormat) {
    try {
      const exportPackage = await exportAudit({ format, filters });
      toast.success(
        `Downloaded ${format.toUpperCase()} export with ${exportPackage.summary.eventCount} events.`
      );
    } catch (exportError) {
      console.error(exportError);
      toast.error(getErrorMessage(exportError));
    }
  }

  return (
    <section className="space-y-5 border-t border-border/80 pt-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Compliance audit export</h2>
        <p className="text-sm text-muted-foreground">
          Export a chronology of report activity.
        </p>
      </div>

      <div className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="audit-export-date-from">Date from</Label>
            <Input
              id="audit-export-date-from"
              type="date"
              value={filters.dateFrom ?? ""}
              onChange={(event) => {
                reset();
                setFilters((current) => ({
                  ...current,
                  dateFrom: event.target.value || null,
                }));
              }}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="audit-export-date-to">Date to</Label>
            <Input
              id="audit-export-date-to"
              type="date"
              value={filters.dateTo ?? ""}
              onChange={(event) => {
                reset();
                setFilters((current) => ({
                  ...current,
                  dateTo: event.target.value || null,
                }));
              }}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="audit-export-consultation">Consultation</Label>
            <select
              id="audit-export-consultation"
              className={SELECT_CLASS_NAME}
              value={filters.consultationId ?? ""}
              onChange={(event) => {
                reset();
                setFilters((current) => ({
                  ...current,
                  consultationId: event.target.value || null,
                }));
              }}
              disabled={isPending || consultationsQuery.isLoading}
            >
              <option value="">All consultations</option>
              {consultations.map((consultation) => (
                <option key={consultation.id} value={consultation.id}>
                  {consultation.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="audit-export-user">User</Label>
            <select
              id="audit-export-user"
              className={SELECT_CLASS_NAME}
              value={filters.userId ?? ""}
              onChange={(event) => {
                reset();
                setFilters((current) => ({
                  ...current,
                  userId: event.target.value || null,
                }));
              }}
              disabled={isPending || usersQuery.isLoading}
            >
              <option value="">All visible users</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1 text-sm">
          <p className="font-medium">Current export</p>
          <p className="text-muted-foreground">
            Date range: {filters.dateFrom ?? "Any"} to {filters.dateTo ?? "Any"}
          </p>
          <p className="text-muted-foreground">
            Consultation: {selectedConsultation?.label ?? "All consultations"}
          </p>
          <p className="text-muted-foreground">
            User: {selectedUser?.label ?? "All visible users"}
          </p>
          {lastExport ? (
            <p className="mt-2 text-muted-foreground">
              Last export: {lastExport.summary.consultationCount} consultation groups and{" "}
              {lastExport.summary.eventCount} events.
            </p>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {getErrorMessage(error)}
          </div>
        ) : null}

        {usersQuery.error ? (
          <p className="text-sm text-muted-foreground">
            User filter options could not be refreshed. You can still export without that filter.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => handleExport("csv")} disabled={isPending}>
            {isPending ? "Preparing..." : "Export CSV"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleExport("json")}
            disabled={isPending}
          >
            {isPending ? "Preparing..." : "Export JSON"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleExport("pdf")}
            disabled={isPending}
          >
            {isPending ? "Preparing..." : "Export PDF"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={isPending || !hasActiveFilters}
            onClick={() => {
              reset();
              setFilters({
                dateFrom: null,
                dateTo: null,
                consultationId: null,
                userId: null,
              });
            }}
          >
            Clear filters
          </Button>
        </div>
      </div>
    </section>
  );
}
