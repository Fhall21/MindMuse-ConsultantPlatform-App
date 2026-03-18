"use client";

import { useId, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useConsultationPeople, usePeople } from "@/hooks/use-people";
import {
  linkPersonToConsultation,
  unlinkPersonFromConsultation,
  createPerson,
} from "@/lib/actions/people";
import { personSchema, type PersonFormData } from "@/lib/validations/consultation";
import type { Person } from "@/types/db";

interface PeoplePanelProps {
  consultationId: string;
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return fallbackMessage;
}

function getDistinctPersonValues(
  people: Person[] | undefined,
  field: "working_group" | "work_type"
) {
  return [...new Set((people ?? []).map((person) => person[field]).filter(isNonEmptyString))].sort(
    (left, right) => left.localeCompare(right)
  );
}

function getPersonSummary(person: Pick<Person, "working_group" | "work_type" | "role" | "email">) {
  return [person.working_group, person.work_type, person.role, person.email]
    .filter(isNonEmptyString)
    .join(" · ");
}

export function PeoplePanel({ consultationId }: PeoplePanelProps) {
  const queryClient = useQueryClient();
  const { data: linkedPeople, isLoading } = useConsultationPeople(consultationId);
  const { data: allPeople } = usePeople();
  const workingGroupListId = useId();
  const workTypeListId = useId();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PersonFormData>({
    resolver: zodResolver(personSchema),
    defaultValues: { name: "", working_group: "", work_type: "", role: "", email: "" },
  });

  const linkedIds = useMemo(() => new Set(linkedPeople?.map((person) => person.id) ?? []), [linkedPeople]);
  const workingGroupOptions = useMemo(
    () => getDistinctPersonValues(allPeople, "working_group"),
    [allPeople]
  );
  const workTypeOptions = useMemo(
    () => getDistinctPersonValues(allPeople, "work_type"),
    [allPeople]
  );

  const filteredPeople = useMemo(
    () =>
      (allPeople ?? []).filter((person) => {
        if (linkedIds.has(person.id)) {
          return false;
        }

        const normalizedSearch = search.trim().toLowerCase();
        if (!normalizedSearch) {
          return true;
        }

        return [person.name, person.working_group, person.work_type, person.role, person.email]
          .filter(isNonEmptyString)
          .some((value) => value.toLowerCase().includes(normalizedSearch));
      }),
    [allPeople, linkedIds, search]
  );

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["consultation_people", consultationId] });
    queryClient.invalidateQueries({ queryKey: ["people"] });
  }

  async function handleLink(person: Person) {
    setLinking(person.id);
    try {
      await linkPersonToConsultation(consultationId, person.id);
      invalidate();
      setDialogOpen(false);
      setSearch("");
    } catch (err) {
      console.error(err);
      toast.error(getErrorMessage(err, "Failed to link person."));
    } finally {
      setLinking(null);
    }
  }

  async function handleUnlink(personId: string) {
    setUnlinking(personId);
    try {
      await unlinkPersonFromConsultation(consultationId, personId);
      invalidate();
    } catch (err) {
      console.error(err);
      toast.error(getErrorMessage(err, "Failed to unlink person."));
    } finally {
      setUnlinking(null);
    }
  }

  async function handleCreate(data: PersonFormData) {
    setCreating(true);
    try {
      const personId = await createPerson({
        name: data.name.trim(),
        working_group: data.working_group?.trim() || undefined,
        work_type: data.work_type?.trim() || undefined,
        role: data.role?.trim() || undefined,
        email: data.email?.trim() || undefined,
      });
      await linkPersonToConsultation(consultationId, personId);
      invalidate();
      setDialogOpen(false);
      setShowCreateForm(false);
      setSearch("");
      reset();
    } catch (err) {
      console.error(err);
      toast.error(getErrorMessage(err, "Failed to create and link person."));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-3">
      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {!isLoading && (!linkedPeople || linkedPeople.length === 0) && (
        <p className="text-sm text-muted-foreground">No people linked yet.</p>
      )}

      {linkedPeople && linkedPeople.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {linkedPeople.map((person) => (
            <span key={person.id} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm">
              <span>{person.name}</span>
              {getPersonSummary(person) ? (
                <span className="text-muted-foreground">· {getPersonSummary(person)}</span>
              ) : null}
              <button
                onClick={() => handleUnlink(person.id)}
                disabled={unlinking === person.id}
                aria-label={`Unlink ${person.name}`}
                className="ml-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setDialogOpen(true);
          setShowCreateForm(false);
          setSearch("");
          reset();
        }}
      >
        Add person
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link a person</DialogTitle>
          </DialogHeader>

          {!showCreateForm ? (
            <div className="space-y-3">
              <Input
                placeholder="Search by name, working group, work type, role, or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />

              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredPeople.length === 0 && (
                  <p className="py-2 text-center text-sm text-muted-foreground">
                    No matches.
                  </p>
                )}
                {filteredPeople.map((person) => (
                  <button
                    key={person.id}
                    onClick={() => handleLink(person)}
                    disabled={linking === person.id}
                    className="flex w-full flex-col items-start rounded px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
                  >
                    <span className="font-medium">{person.name}</span>
                    {getPersonSummary(person) ? (
                      <span className="text-muted-foreground">{getPersonSummary(person)}</span>
                    ) : null}
                  </button>
                ))}
              </div>

              <div className="border-t pt-3">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowCreateForm(true)}
                  className="w-full"
                >
                  + Create new person
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="person-name">Name</Label>
                <Input id="person-name" {...register("name")} autoFocus />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-person-working-group">Working Group (optional)</Label>
                <Input
                  id="new-person-working-group"
                  list={workingGroupListId}
                  {...register("working_group")}
                />
                <datalist id={workingGroupListId}>
                  {workingGroupOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
                {errors.working_group && (
                  <p className="text-sm text-destructive">
                    {errors.working_group.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-person-work-type">Work Type (optional)</Label>
                <Input
                  id="new-person-work-type"
                  list={workTypeListId}
                  placeholder="Employee, Manager, Contractor..."
                  {...register("work_type")}
                />
                <datalist id={workTypeListId}>
                  {workTypeOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
                {errors.work_type && (
                  <p className="text-sm text-destructive">{errors.work_type.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="person-role">Role (optional)</Label>
                <Input id="person-role" {...register("role")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="person-email">Email (optional)</Label>
                <Input id="person-email" type="email" {...register("email")} />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCreateForm(false)}
                >
                  Back
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating…" : "Create & link"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
