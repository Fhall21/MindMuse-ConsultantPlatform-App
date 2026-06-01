"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePeople } from "@/hooks/use-people";
import { createPerson } from "@/lib/actions/people";
import { getDistinctCaseInsensitiveValues } from "@/lib/people-classifications";
import type { Person } from "@/types/db";

export interface PeopleFieldProps {
  selected: Person[];
  onAdd: (person: Person) => void;
  onRemove: (id: string) => void;
  suggestedExisting?: Person[];
  onDismissSuggestedExisting?: (id: string) => void;
  suggestedNewNames?: string[];
  onDismissSuggestedNew?: (name: string) => void;
}

export function PeopleField({
  selected,
  onAdd,
  onRemove,
  suggestedExisting = [],
  onDismissSuggestedExisting,
  suggestedNewNames = [],
  onDismissSuggestedNew,
}: PeopleFieldProps) {
  const { data: allPeople = [] } = usePeople();
  const [search, setSearch] = useState("");
  const [creatingName, setCreatingName] = useState("");
  const [creatingWorkGroup, setCreatingWorkGroup] = useState("");
  const [creatingWorkType, setCreatingWorkType] = useState("");
  const [creatingRole, setCreatingRole] = useState("");
  const [creatingEmail, setCreatingEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [creating, setCreatingState] = useState(false);

  const workingGroupOptions = useMemo(
    () => getDistinctCaseInsensitiveValues(allPeople.map((p) => p.working_group)),
    [allPeople]
  );
  const workTypeOptions = useMemo(
    () => getDistinctCaseInsensitiveValues(allPeople.map((p) => p.work_type)),
    [allPeople]
  );
  const hasNoPeople = allPeople.length === 0;
  const showEmptyState =
    selected.length === 0 && suggestedExisting.length === 0 && suggestedNewNames.length === 0;

  const filteredPeople = useMemo(() => {
    const selectedIds = new Set(selected.map((p) => p.id));
    return allPeople
      .filter((p) => !selectedIds.has(p.id))
      .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [allPeople, selected, search]);

  const handleSelectExisting = (person: Person) => {
    onAdd(person);
    setSearch("");
  };

  const handleCreateNew = async () => {
    const name = creatingName.trim();
    if (!name) {
      return;
    }
    setCreatingState(true);
    try {
      const newId = await createPerson({
        name,
        working_group: creatingWorkGroup.trim() || undefined,
        work_type: creatingWorkType.trim() || undefined,
        role: creatingRole.trim() || undefined,
        email: creatingEmail.trim() || undefined,
      });
      const newPerson: Person = {
        id: newId,
        name,
        working_group: creatingWorkGroup.trim() || null,
        work_type: creatingWorkType.trim() || null,
        role: creatingRole.trim() || null,
        email: creatingEmail.trim() || null,
        created_at: new Date().toISOString(),
        user_id: "",
      };
      onAdd(newPerson);
      setCreatingName("");
      setCreatingWorkGroup("");
      setCreatingWorkType("");
      setCreatingRole("");
      setCreatingEmail("");
      setIsCreating(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create person");
    } finally {
      setCreatingState(false);
    }
  };

  return (
    <div className="space-y-2">
      {showEmptyState ? (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">No people added yet</p>
            <p className="text-xs text-muted-foreground">
              Add at least one person so the meeting can be created.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => setIsCreating(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add person
          </Button>
        </div>
      ) : null}

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((person) => (
            <span
              key={person.id}
              className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-1.5 text-sm shadow-none"
            >
              <span className="max-w-[14rem] truncate font-medium">{person.name}</span>
              <button
                type="button"
                onClick={() => onRemove(person.id)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {suggestedExisting.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Found in your contacts — confirm to add</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestedExisting.map((person) => (
              <div
                key={person.id}
                className="inline-flex items-center gap-1 rounded-md border border-dashed border-border bg-muted/20 py-1 pl-1.5 pr-1 text-xs"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  title={`Add ${person.name}`}
                  onClick={() => {
                    onAdd(person);
                    onDismissSuggestedExisting?.(person.id);
                  }}
                  className="h-7 rounded-md px-2 text-xs hover:bg-green-100 dark:hover:bg-green-900/30"
                >
                  <Plus className="mr-1 h-3 w-3 text-green-600" />
                  Add {person.name.split(/\s+/)[0]}
                </Button>
                <button
                  type="button"
                  title="Dismiss"
                  onClick={() => onDismissSuggestedExisting?.(person.id)}
                  className="rounded-md p-1 transition-colors hover:bg-muted"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {suggestedNewNames.length > 0 && !isCreating ? (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">New people from transcript — click to add</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestedNewNames.map((name) => (
              <Button
                key={name}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onDismissSuggestedNew?.(name);
                  setCreatingName(name);
                  setIsCreating(true);
                }}
                className="h-8 rounded-md border-dashed px-2.5 text-xs transition-colors hover:bg-muted/50"
              >
                <Plus className="h-3 w-3" />
                Add {name}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {isCreating ? (
        <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-3">
          <div className="flex items-center gap-2">
            <Input
              value={creatingName}
              onChange={(event) => setCreatingName(event.target.value)}
              placeholder="Full name"
              className="h-8 flex-1 text-sm"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleCreateNew();
                }
                if (event.key === "Escape") {
                  setIsCreating(false);
                  setCreatingName("");
                  setCreatingWorkGroup("");
                  setCreatingWorkType("");
                  setCreatingRole("");
                  setCreatingEmail("");
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              onClick={() => {
                setIsCreating(false);
                setCreatingName("");
                setCreatingWorkGroup("");
                setCreatingWorkType("");
                setCreatingRole("");
                setCreatingEmail("");
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <AutocompleteInput
                value={creatingWorkGroup}
                onChange={setCreatingWorkGroup}
                options={workingGroupOptions}
                placeholder="Work group (optional)"
                className="h-8 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Reuse an existing work group or type a new one.
              </p>
            </div>
            <div className="space-y-1">
              <AutocompleteInput
                value={creatingWorkType}
                onChange={setCreatingWorkType}
                options={workTypeOptions}
                placeholder="Work type (optional)"
                className="h-8 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Reuse an existing work type or type a new one.
              </p>
            </div>
            <Input
              value={creatingRole}
              onChange={(event) => setCreatingRole(event.target.value)}
              placeholder="Role (optional)"
              className="h-8 text-sm"
            />
            <Input
              value={creatingEmail}
              onChange={(event) => setCreatingEmail(event.target.value)}
              placeholder="Email (optional)"
              className="h-8 text-sm"
              type="email"
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              disabled={!creatingName.trim() || creating}
              onClick={() => void handleCreateNew()}
              className="h-8 text-xs"
            >
              Confirm
            </Button>
          </div>
        </div>
      ) : !hasNoPeople ? (
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search people…"
            className="h-8 flex-1 text-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0 text-xs"
            onClick={() => {
              setIsCreating(true);
              setSearch("");
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add person
          </Button>
        </div>
      ) : null}

      {!isCreating && search && filteredPeople.length > 0 ? (
        <ul className="max-h-40 overflow-y-auto rounded-md border border-border/60 bg-popover shadow-sm">
          {filteredPeople.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                onClick={() => handleSelectExisting(person)}
              >
                {person.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
