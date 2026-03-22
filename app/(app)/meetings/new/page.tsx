"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createMeeting } from "@/lib/actions/consultations";
import { createPerson } from "@/lib/actions/people";
import { useConsultations } from "@/hooks/use-consultations";
import { useMeetingTypes } from "@/hooks/use-meeting-types";
import { usePeople } from "@/hooks/use-people";
import { buildMeetingTitle } from "@/lib/meeting-title";
import type { Person } from "@/types/db";

// ─── Consultation combobox ────────────────────────────────────────────────────

function ConsultationField({
  value,
  onChange,
  newLabel,
  onNewLabelChange,
}: {
  value: string;
  onChange: (id: string) => void;
  newLabel: string;
  onNewLabelChange: (v: string) => void;
}) {
  const { data: consultations = [] } = useConsultations();
  const [creating, setCreating] = useState(false);

  if (creating) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={newLabel}
          onChange={(e) => onNewLabelChange(e.target.value)}
          placeholder="Consultation name"
          className="h-9 flex-1 text-sm"
          autoFocus
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-9 px-2 text-xs text-muted-foreground"
          onClick={() => {
            onNewLabelChange("");
            setCreating(false);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">No consultation</option>
          {consultations.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-9 shrink-0 text-xs"
        onClick={() => {
          onChange("");
          setCreating(true);
        }}
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        New
      </Button>
    </div>
  );
}

// ─── People multi-select ──────────────────────────────────────────────────────

function PeopleField({
  selected,
  onAdd,
  onRemove,
}: {
  selected: Person[];
  onAdd: (person: Person) => void;
  onRemove: (id: string) => void;
}) {
  const { data: allPeople = [] } = usePeople();
  const [search, setSearch] = useState("");
  const [creatingName, setCreatingName] = useState("");
  const [creatingWorkGroup, setCreatingWorkGroup] = useState("");
  const [creatingWorkType, setCreatingWorkType] = useState("");
  const [creatingRole, setCreatingRole] = useState("");
  const [creatingEmail, setCreatingEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [creating, setCreatingState] = useState(false);

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
    if (!name) return;
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create person");
    } finally {
      setCreatingState(false);
    }
  };

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((p) => (
            <Badge
              key={p.id}
              variant="secondary"
              className="gap-1 pl-2.5 pr-1.5 py-1 text-xs"
            >
              {p.name.split(/\s+/)[0]}
              <button
                type="button"
                onClick={() => onRemove(p.id)}
                className="ml-0.5 rounded hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {isCreating ? (
        <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <Input
              value={creatingName}
              onChange={(e) => setCreatingName(e.target.value)}
              placeholder="Full name"
              className="h-8 flex-1 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateNew();
                }
                if (e.key === "Escape") {
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
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={creatingWorkGroup}
              onChange={(e) => setCreatingWorkGroup(e.target.value)}
              placeholder="Work group (optional)"
              className="h-8 text-sm"
            />
            <Input
              value={creatingWorkType}
              onChange={(e) => setCreatingWorkType(e.target.value)}
              placeholder="Work type (optional)"
              className="h-8 text-sm"
            />
            <Input
              value={creatingRole}
              onChange={(e) => setCreatingRole(e.target.value)}
              placeholder="Role (optional)"
              className="h-8 text-sm"
            />
            <Input
              value={creatingEmail}
              onChange={(e) => setCreatingEmail(e.target.value)}
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
              onClick={handleCreateNew}
              className="h-8 text-xs"
            >
              Add
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
            New
          </Button>
        </div>
      )}

      {!isCreating && search && filteredPeople.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-md border border-border/60 bg-popover shadow-sm">
          {filteredPeople.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
                onClick={() => handleSelectExisting(p)}
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewMeetingPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const { data: meetingTypes = [] } = useMeetingTypes();

  // Form state
  const [consultationId, setConsultationId] = useState("");
  const [newConsultationLabel, setNewConsultationLabel] = useState("");
  const [meetingTypeId, setMeetingTypeId] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [selectedPeople, setSelectedPeople] = useState<Person[]>([]);
  const [title, setTitle] = useState("");
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);

  // Auto-generate title
  const selectedType = meetingTypes.find((t) => t.id === meetingTypeId);
  const generatedTitle = useMemo(() => {
    const firstNames = selectedPeople.map((p) => p.name.split(/\s+/)[0]);
    const date = meetingDate ? new Date(meetingDate + "T12:00:00") : null;
    return buildMeetingTitle(selectedType?.code, firstNames, date);
  }, [selectedType, selectedPeople, meetingDate]);

  useEffect(() => {
    if (!titleManuallyEdited) {
      setTitle(generatedTitle);
    }
  }, [generatedTitle, titleManuallyEdited]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("A meeting title is required");
      return;
    }
    setSubmitting(true);
    try {
      const id = await createMeeting({
        title: title.trim(),
        consultationId: consultationId || undefined,
        newConsultationLabel: newConsultationLabel || undefined,
        meetingTypeId: meetingTypeId || undefined,
        meetingDate: meetingDate ? new Date(meetingDate + "T12:00:00") : undefined,
        personIds: selectedPeople.map((p) => p.id),
      });
      router.push(`/meetings/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create meeting");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">New Meeting</h1>
        <p className="text-sm text-muted-foreground">
          Create the record first. Add material after.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Consultation */}
        <div className="space-y-2">
          <Label>Consultation</Label>
          <ConsultationField
            value={consultationId}
            onChange={setConsultationId}
            newLabel={newConsultationLabel}
            onNewLabelChange={setNewConsultationLabel}
          />
          {newConsultationLabel && (
            <p className="text-xs text-muted-foreground">
              A new consultation &ldquo;{newConsultationLabel}&rdquo; will be created.
            </p>
          )}
        </div>

        {/* Meeting type */}
        <div className="space-y-2">
          <Label htmlFor="meetingType">Meeting Type</Label>
          <div className="relative">
            <select
              id="meetingType"
              value={meetingTypeId}
              onChange={(e) => setMeetingTypeId(e.target.value)}
              className="flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select type…</option>
              {meetingTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} ({t.code})
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        {/* Date */}
        <div className="space-y-2">
          <Label htmlFor="meetingDate">Date</Label>
          <Input
            id="meetingDate"
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            className="h-9 text-sm"
          />
        </div>

        {/* People */}
        <div className="space-y-2">
          <Label>People</Label>
          <PeopleField
            selected={selectedPeople}
            onAdd={(p) => setSelectedPeople((prev) => [...prev, p])}
            onRemove={(id) =>
              setSelectedPeople((prev) => prev.filter((p) => p.id !== id))
            }
          />
        </div>

        {/* Title — derived but editable */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="title">Title</Label>
            {titleManuallyEdited && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                onClick={() => {
                  setTitleManuallyEdited(false);
                  setTitle(generatedTitle);
                }}
              >
                Reset to generated
              </button>
            )}
          </div>
          <Input
            id="title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleManuallyEdited(true);
            }}
            placeholder="Meeting title"
            className="h-9 text-sm"
          />
          {!titleManuallyEdited && !title && (
            <p className="text-xs text-muted-foreground">
              Select a type, people, or date to auto-generate a title.
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={submitting || !title.trim()}>
            {submitting ? "Creating…" : "Create meeting"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/meetings")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

