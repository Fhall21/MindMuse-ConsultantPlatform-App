"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PersonForm } from "@/components/people/person-form";
import { PersonSheet } from "@/components/people/person-sheet";
import { PersonTable, type PersonTableRow } from "@/components/people/person-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fetchJson } from "@/hooks/api";
import { usePeople } from "@/hooks/use-people";
import { deletePerson, createPerson, updatePerson } from "@/lib/actions/people";
import { getDistinctCaseInsensitiveValues, isNonEmptyString } from "@/lib/people-classifications";
import type { Person } from "@/types/db";
import type { PersonFormData } from "@/lib/validations/consultation";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return "Unable to save this person right now.";
}

function getDistinctPersonValues(
  people: Person[] | undefined,
  field: "working_group" | "work_type"
) {
  return getDistinctCaseInsensitiveValues((people ?? []).map((person) => person[field]));
}

export default function PeoplePage() {
  const queryClient = useQueryClient();
  const peopleQuery = usePeople();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  const people = peopleQuery.data;
  const workingGroupOptions = useMemo(
    () => getDistinctPersonValues(people, "working_group"),
    [people]
  );
  const workTypeOptions = useMemo(
    () => getDistinctPersonValues(people, "work_type"),
    [people]
  );

  const personIds = useMemo(() => (people ?? []).map((person) => person.id), [people]);

  const consultationCountsQuery = useQuery({
    queryKey: ["people", "consultation_counts", personIds],
    queryFn: () =>
      fetchJson<Record<string, number>>("/api/client/people/consultation-counts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: personIds }),
      }),
    enabled: personIds.length > 0,
  });

  const createMutation = useMutation({
    mutationFn: (payload: PersonFormData) =>
      createPerson({
        name: payload.name,
        working_group: payload.working_group,
        work_type: payload.work_type,
        role: payload.role,
        email: payload.email,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["people"] });
      setDialogOpen(false);
      setEditingPerson(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: PersonFormData) => {
      if (!editingPerson) throw new Error("No person selected for update");

      return updatePerson({
        id: editingPerson.id,
        name: payload.name,
        working_group: payload.working_group,
        work_type: payload.work_type,
        role: payload.role,
        email: payload.email,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["people"] });
      setDialogOpen(false);
      setEditingPerson(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (personId: string) => deletePerson(personId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["people"] });
      await queryClient.invalidateQueries({ queryKey: ["consultation_people"] });
      if (selectedPersonId) {
        setSelectedPersonId(null);
      }
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const rows = useMemo<PersonTableRow[]>(() => {
    const counts = consultationCountsQuery.data ?? {};

    return (people ?? []).map((person) => ({
      ...person,
      consultationCount: counts[person.id] ?? 0,
    }));
  }, [people, consultationCountsQuery.data]);

  const filteredRows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return rows;

    return rows.filter((row) =>
      [row.name, row.working_group, row.work_type, row.role, row.email]
        .filter(isNonEmptyString)
        .some((value) => value.toLowerCase().includes(normalized))
    );
  }, [rows, search]);

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isLoading = peopleQuery.isLoading || consultationCountsQuery.isLoading;
  const hasNoPeople = !isLoading && rows.length === 0;
  const hasNoResults = !isLoading && rows.length > 0 && filteredRows.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">People</h1>
        <Button
          onClick={() => {
            setEditingPerson(null);
            setDialogOpen(true);
          }}
        >
          Add Person
        </Button>
      </div>

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by name, working group, work type, role, or email"
        className="w-full sm:max-w-xs"
      />

      {hasNoPeople ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="mb-4 text-muted-foreground">No people added yet.</p>
          <Button
            size="lg"
            onClick={() => {
              setEditingPerson(null);
              setDialogOpen(true);
            }}
          >
            Add Person
          </Button>
        </div>
      ) : hasNoResults ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No matching people.
        </div>
      ) : (
        <PersonTable
          data={filteredRows}
          onEdit={(person) => {
            setEditingPerson(person);
            setDialogOpen(true);
          }}
          onDelete={(person) => {
            const confirmed = window.confirm(
              `Delete ${person.name}? This will remove them from all consultations.`
            );

            if (confirmed) {
              deleteMutation.mutate(person.id);
            }
          }}
          onRowClick={setSelectedPersonId}
        />
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          setDialogOpen(nextOpen);
          if (!nextOpen) {
            setEditingPerson(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPerson ? "Edit Person" : "Add Person"}</DialogTitle>
            <DialogDescription>
              Save core details and reusable classifications for people you may link to
              consultations.
            </DialogDescription>
          </DialogHeader>

          <PersonForm
            defaultValues={editingPerson ?? undefined}
            isLoading={isSaving}
            submitLabel={editingPerson ? "Update Person" : "Create Person"}
            workingGroupOptions={workingGroupOptions}
            workTypeOptions={workTypeOptions}
            onSubmit={async (values) => {
              try {
                if (editingPerson) {
                  await updateMutation.mutateAsync(values);
                  return;
                }

                await createMutation.mutateAsync(values);
              } catch (error) {
                toast.error(getErrorMessage(error));
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {selectedPersonId ? (
        <PersonSheet
          personId={selectedPersonId}
          open={!!selectedPersonId}
          onClose={() => setSelectedPersonId(null)}
        />
      ) : null}
    </div>
  );
}
