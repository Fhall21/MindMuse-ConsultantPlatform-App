"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Archive, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  useMeetingTypes,
  useCreateMeetingType,
  useUpdateMeetingType,
  useArchiveMeetingType,
  useDeleteMeetingType,
} from "@/hooks/use-meeting-types";
import type { MeetingType } from "@/types/db";

// ─── Inline edit row ──────────────────────────────────────────────────────────

function EditRow({
  initialLabel,
  initialCode,
  onSave,
  onCancel,
}: {
  initialLabel: string;
  initialCode: string;
  onSave: (label: string, code: string) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initialLabel);
  const [code, setCode] = useState(initialCode);

  return (
    <div className="flex items-center gap-2">
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label"
        className="h-8 flex-1 text-sm"
        autoFocus
      />
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Code"
        className="h-8 w-24 text-sm font-mono"
        maxLength={10}
      />
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0"
        onClick={() => onSave(label, code)}
        disabled={!label.trim() || !code.trim()}
      >
        <Check className="h-4 w-4 text-emerald-600" />
      </Button>
      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onCancel}>
        <X className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  );
}

// ─── Meeting type row ─────────────────────────────────────────────────────────

function MeetingTypeRow({ meetingType }: { meetingType: MeetingType }) {
  const [editing, setEditing] = useState(false);
  const update = useUpdateMeetingType();
  const archive = useArchiveMeetingType();
  const remove = useDeleteMeetingType();

  const handleSave = (label: string, code: string) => {
    update.mutate(
      { id: meetingType.id, label, code },
      {
        onSuccess: () => {
          setEditing(false);
          toast.success("Meeting type updated");
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const handleArchive = () => {
    archive.mutate(meetingType.id, {
      onSuccess: () => toast.success(`"${meetingType.label}" archived`),
      onError: (e) => toast.error(e.message),
    });
  };

  const handleDelete = () => {
    remove.mutate(meetingType.id, {
      onSuccess: () => toast.success(`"${meetingType.label}" deleted`),
      onError: (e) => toast.error(e.message),
    });
  };

  if (editing) {
    return (
      <EditRow
        initialLabel={meetingType.label}
        initialCode={meetingType.code}
        onSave={handleSave}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/5 px-4 py-2.5">
      <span className="flex-1 text-sm font-medium">{meetingType.label}</span>
      <Badge variant="outline" className="font-mono text-[11px]">
        {meetingType.code}
      </Badge>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => setEditing(true)}
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={handleArchive}
          disabled={archive.isPending}
          title="Archive"
        >
          <Archive className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={handleDelete}
          disabled={remove.isPending}
          title="Delete (only if unused)"
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
        </Button>
      </div>
    </div>
  );
}

// ─── Add form ─────────────────────────────────────────────────────────────────

function AddMeetingTypeForm({ onDone }: { onDone: () => void }) {
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const create = useCreateMeetingType();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      { label: label.trim(), code: code.trim() },
      {
        onSuccess: () => {
          toast.success("Meeting type created");
          onDone();
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-dashed border-border p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="mt-label" className="text-xs">Label</Label>
          <Input
            id="mt-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Focus Group"
            className="h-8 text-sm"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mt-code" className="text-xs">Code</Label>
          <Input
            id="mt-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. FC"
            className="h-8 text-sm font-mono"
            maxLength={10}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={!label.trim() || !code.trim() || create.isPending}
        >
          Add
        </Button>
      </div>
    </form>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function MeetingTypesPanel() {
  const [adding, setAdding] = useState(false);
  const { data: types = [], isLoading } = useMeetingTypes();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Meeting Types</CardTitle>
              <CardDescription className="mt-1">
                Manage the types used to classify and code your meetings. Each type has a short
                code that appears in generated meeting titles.
              </CardDescription>
            </div>
            {!adding && (
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add type
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {adding && <AddMeetingTypeForm onDone={() => setAdding(false)} />}
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-2">Loading…</p>
          ) : types.length === 0 && !adding ? (
            <p className="text-sm text-muted-foreground py-2">
              No active meeting types. Add one above.
            </p>
          ) : (
            types.map((t) => <MeetingTypeRow key={t.id} meetingType={t} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
