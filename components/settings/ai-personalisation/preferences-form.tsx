"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAIPreferences, useUpdateAIPreferences } from "@/hooks/use-ai-preferences";
import { toast } from "sonner";

function TagInput({
  label,
  description,
  tags,
  onChange,
  max,
  maxLength,
  placeholder,
}: {
  label: string;
  description: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  max: number;
  maxLength: number;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  function handleAdd() {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      toast.error("Already added");
      return;
    }
    if (tags.length >= max) {
      toast.error(`Maximum ${max} items allowed`);
      return;
    }
    onChange([...tags, trimmed]);
    setInput("");
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="space-y-2">
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="mt-4 flex gap-2">
        <Input
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          maxLength={maxLength}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleAdd}
          disabled={!input.trim() || tags.length >= max}
        >
          Add
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter((t) => t !== tag))}
                className="ml-1 rounded-sm px-0.5 hover:bg-muted"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        {tags.length}/{max} used
      </p>
    </div>
  );
}

export function PreferencesForm() {
  const { data: prefs, isLoading } = useAIPreferences();
  const { mutate: save, isPending } = useUpdateAIPreferences();

  const [consultationTypes, setConsultationTypes] = useState<string[]>([]);
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [industry, setIndustry] = useState("");
  const [excludedTopics, setExcludedTopics] = useState<string[]>([]);
  const [emailGuidance, setEmailGuidance] = useState("");
  const [anonymousMode, setAnonymousMode] = useState(true);

  useEffect(() => {
    if (prefs) {
      setConsultationTypes(prefs.consultationTypes ?? []);
      setFocusAreas(prefs.focusAreas ?? []);
      setIndustry(prefs.industry ?? "");
      setExcludedTopics(prefs.excludedTopics ?? []);
      setEmailGuidance(prefs.emailGuidance ?? "");
      setAnonymousMode(prefs.anonymousMode ?? true);
    }
  }, [prefs]);

  function handleSave() {
    save(
      {
        consultationTypes,
        focusAreas,
        industry,
        excludedTopics,
        emailGuidance,
        anonymousMode,
      },
      {
        onSuccess: () => toast.success("Preferences saved"),
        onError: (err) =>
          toast.error(err.message || "Failed to save preferences"),
      }
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-sm text-muted-foreground">
            Loading preferences…
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generation Preferences</CardTitle>
        <CardDescription>
          Tell the AI what types of consultations you run and where to focus.
          These preferences guide how insights are extracted, how evidence emails are drafted,
          and how outward-facing outputs are rendered.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <TagInput
          label="Project types"
          description="What types of projects do you primarily conduct? This helps the AI understand your context."
          tags={consultationTypes}
          onChange={setConsultationTypes}
          max={5}
          maxLength={100}
          placeholder="e.g., Psychosocial, Design Thinking, Clinical"
        />

        <TagInput
          label="Focus areas"
          description="Topics or patterns the AI should prioritise when extracting insights."
          tags={focusAreas}
          onChange={setFocusAreas}
          max={10}
          maxLength={200}
          placeholder="e.g., Emotional patterns, Team dynamics"
        />

        <div className="rounded-xl border p-4">
          <div className="space-y-2">
            <p className="font-medium">Industry / practice area</p>
            <p className="text-sm text-muted-foreground">
              Give research tools the professional context they should assume.
            </p>
          </div>
          <Input
            className="mt-4"
            maxLength={150}
            placeholder="e.g. Organisational psychology, Public sector, Healthcare consulting"
            value={industry}
            onChange={(event) => setIndustry(event.target.value)}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {industry.length}/150 used
          </p>
        </div>

        <TagInput
          label="Topics to exclude"
          description="Topics or patterns the AI should avoid surfacing unless clearly substantive."
          tags={excludedTopics}
          onChange={setExcludedTopics}
          max={10}
          maxLength={200}
          placeholder="e.g., Administrative scheduling, Small talk"
        />

        <div className="rounded-xl border p-4">
          <div className="space-y-2">
            <p className="font-medium">Evidence email guidance</p>
            <p className="text-sm text-muted-foreground">
              Add one short note about how generated evidence emails should read.
              Use this for output shape, tone, or level of directness.
            </p>
          </div>
          <Textarea
            className="mt-4 min-h-28"
            maxLength={600}
            placeholder="e.g., Keep emails brief, lead with actions, and avoid repeating transcript wording."
            value={emailGuidance}
            onChange={(event) => setEmailGuidance(event.target.value)}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {emailGuidance.length}/600 used
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="anonymous-mode"
              checked={anonymousMode}
              onCheckedChange={(checked) => setAnonymousMode(checked === true)}
              className="mt-0.5"
            />
            <div className="space-y-2">
              <label htmlFor="anonymous-mode" className="font-medium leading-none">
                Anonymous rendered outputs
              </label>
              <p className="text-sm text-muted-foreground">
                Use work-group or work-type phrasing in reports and exports so outward-facing
                output avoids direct person-name references while source records stay exact.
              </p>
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={isPending} className="w-full">
          {isPending ? "Saving…" : "Save preferences"}
        </Button>
      </CardContent>
    </Card>
  );
}
