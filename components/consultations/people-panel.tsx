"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
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
import type { Person } from "@/types/db";

interface PeoplePanelProps {
  consultationId: string;
}

const newPersonSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  role: z.string().max(255).optional(),
  email: z.email("Invalid email address").optional().or(z.literal("")),
});

type NewPersonFormData = z.infer<typeof newPersonSchema>;

export function PeoplePanel({ consultationId }: PeoplePanelProps) {
  const queryClient = useQueryClient();
  const { data: linkedPeople, isLoading } = useConsultationPeople(consultationId);
  const { data: allPeople } = usePeople();

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
  } = useForm<NewPersonFormData>({
    resolver: zodResolver(newPersonSchema),
    defaultValues: { name: "", role: "", email: "" },
  });

  const linkedIds = new Set(linkedPeople?.map((p) => p.id) ?? []);

  const filteredPeople = (allPeople ?? []).filter(
    (p) =>
      !linkedIds.has(p.id) &&
      p.name.toLowerCase().includes(search.toLowerCase())
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
      toast.error("Failed to link person.");
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
      toast.error("Failed to unlink person.");
    } finally {
      setUnlinking(null);
    }
  }

  async function handleCreate(data: NewPersonFormData) {
    setCreating(true);
    try {
      const personId = await createPerson({
        name: data.name,
        role: data.role || undefined,
        email: data.email || undefined,
      });
      await linkPersonToConsultation(consultationId, personId);
      invalidate();
      setDialogOpen(false);
      setShowCreateForm(false);
      setSearch("");
      reset();
    } catch (err) {
      console.error(err);
      toast.error("Failed to create and link person.");
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
            <span
              key={person.id}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
            >
              <span>{person.name}</span>
              {person.role && (
                <span className="text-muted-foreground">· {person.role}</span>
              )}
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
                placeholder="Search by name…"
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
                    className="flex w-full items-center justify-between rounded px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
                  >
                    <span>
                      {person.name}
                      {person.role && (
                        <span className="ml-2 text-muted-foreground">
                          {person.role}
                        </span>
                      )}
                    </span>
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
