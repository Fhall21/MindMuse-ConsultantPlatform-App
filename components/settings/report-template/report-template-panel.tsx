"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  createReportTemplate,
  addTemplateSuggestion,
  deleteReportTemplate,
  listReportTemplates,
  removeTemplateSuggestion,
  updateReportTemplate,
  updateTemplateSuggestion,
  saveBuilderTemplate,
} from "@/lib/actions/report-templates";
import type {
  ReportTemplate,
  ReportTemplateSection,
  ReportTemplatePrescriptiveness,
} from "@/types/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ReportBuilder } from "./report-builder";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalysedTemplate {
  name: string;
  description: string;
  sections: ReportTemplateSection[];
  style_notes: {
    tone: string | null;
    person: string | null;
    formatting_notes: string | null;
  };
}

// ─── Prescriptiveness selector ────────────────────────────────────────────────

const PRESCRIPTIVENESS_OPTIONS: Array<{
  value: ReportTemplatePrescriptiveness;
  label: string;
  description: string;
}> = [
  {
    value: "flexible",
    label: "Flexible",
    description: "High-level guidance only — AI adapts freely to the data.",
  },
  {
    value: "moderate",
    label: "Moderate",
    description: "Clear structure with room to adapt wording and emphasis.",
  },
  {
    value: "strict",
    label: "Strict",
    description: "Closely mirrors the structure and phrasing of your examples.",
  },
];

function PrescriptivenessSelector({
  value,
  onChange,
}: {
  value: ReportTemplatePrescriptiveness;
  onChange: (v: ReportTemplatePrescriptiveness) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Prescriptiveness</Label>
      <div className="grid grid-cols-3 gap-2">
        {PRESCRIPTIVENESS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
              value === opt.value
                ? "border-foreground/30 bg-foreground/5 font-medium"
                : "border-border/50 hover:bg-muted/30"
            }`}
          >
            <p className="font-medium">{opt.label}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground leading-tight">
              {opt.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Section preview ──────────────────────────────────────────────────────────

function SectionPreview({ section, index }: { section: ReportTemplateSection; index: number }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/5 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">{section.heading}</p>
          {section.purpose && (
            <p className="text-xs text-muted-foreground">{section.purpose}</p>
          )}
          {section.prose_guidance && (
            <p className="mt-1 text-xs leading-relaxed text-foreground/70 italic">
              {section.prose_guidance}
            </p>
          )}
          {section.example_excerpt && (
            <blockquote className="mt-1.5 border-l-2 border-border/60 pl-2 text-[11px] text-muted-foreground/70">
              &ldquo;{section.example_excerpt}&rdquo;
            </blockquote>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Active template card ─────────────────────────────────────────────────────

function ActiveTemplateCard({
  template,
  onDeactivate,
  onDelete,
  onEditInBuilder,
}: {
  template: ReportTemplate;
  onDeactivate: () => void;
  onDelete: () => void;
  onEditInBuilder: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{template.name}</CardTitle>
              <Badge
                variant="outline"
                className="border-emerald-300 text-[10px] text-emerald-700 dark:border-emerald-700 dark:text-emerald-400"
              >
                Active
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {template.prescriptiveness}
              </Badge>
            </div>
            {template.description && (
              <CardDescription className="mt-1">{template.description}</CardDescription>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={onEditInBuilder}
              className="text-xs"
            >
              Edit in builder
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs"
            >
              {expanded ? "Hide sections" : `View ${template.sections.length} sections`}
            </Button>
            <Button size="sm" variant="ghost" onClick={onDeactivate} className="text-xs">
              Deactivate
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              className="text-xs text-destructive hover:text-destructive"
            >
              Delete
            </Button>
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-2 pt-0">
          {template.sections.map((section, i) => (
            <SectionPreview key={i} section={section} index={i} />
          ))}
          {template.style_notes && (
            <div className="mt-3 rounded-lg border border-border/40 bg-muted/5 px-4 py-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Style Notes
              </p>
              {template.style_notes.tone && (
                <p className="text-xs text-foreground/80">
                  <span className="font-medium">Tone:</span> {template.style_notes.tone}
                </p>
              )}
              {template.style_notes.person && (
                <p className="text-xs text-foreground/80">
                  <span className="font-medium">Person:</span> {template.style_notes.person}
                </p>
              )}
              {template.style_notes.formatting_notes && (
                <p className="text-xs text-foreground/80">
                  <span className="font-medium">Formatting:</span>{" "}
                  {template.style_notes.formatting_notes}
                </p>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function GenerationGuidanceCard({ template }: { template: ReportTemplate }) {
  const queryClient = useQueryClient();
  const suggestions = [...(template.suggestions ?? [])].sort(
    (left, right) => Date.parse(left.created_at) - Date.parse(right.created_at)
  );
  const [isAddFormVisible, setIsAddFormVisible] = useState(false);
  const [newSuggestionText, setNewSuggestionText] = useState("");
  const [editingSuggestionId, setEditingSuggestionId] = useState<string | null>(null);
  const [editingSuggestionText, setEditingSuggestionText] = useState("");

  const addMutation = useMutation({
    mutationFn: async (text: string) => {
      await addTemplateSuggestion(template.id, text);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-templates"] });
      setNewSuggestionText("");
      setIsAddFormVisible(false);
      toast.success("Guidance note added");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to add guidance note");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: { suggestionId: string; text: string }) => {
      await updateTemplateSuggestion(template.id, input.suggestionId, input.text);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-templates"] });
      setEditingSuggestionId(null);
      setEditingSuggestionText("");
      toast.success("Guidance note updated");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update guidance note");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      await removeTemplateSuggestion(template.id, suggestionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-templates"] });
      toast.success("Guidance note deleted");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete guidance note");
    },
  });

  const suggestionCountLabel = `${suggestions.length} of 10`;
  const showCounter = suggestions.length >= 5;
  const canAddMore = suggestions.length < 10;

  return (
    <Card className="border-border/60 bg-muted/5">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Generation Guidance</CardTitle>
            <CardDescription className="mt-1">
              Add short reminders that should be threaded into every generated report.
            </CardDescription>
          </div>
          {showCounter && (
            <Badge variant="outline" className="text-[10px]">
              {suggestionCountLabel}
            </Badge>
          )}
        </div>
        {!showCounter && canAddMore && (
          <p className="text-xs text-muted-foreground">Add up to 10 guidance notes.</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {suggestions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
            No guidance notes yet.
          </div>
        ) : (
          suggestions.map((suggestion) => {
            const isEditing = editingSuggestionId === suggestion.id;

            return (
              <div key={suggestion.id} className="rounded-lg border border-border/50 bg-background px-4 py-3">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {new Date(suggestion.created_at).toLocaleString()}
                      </p>
                      {isEditing ? (
                        <Textarea
                          value={editingSuggestionText}
                          onChange={(event) => setEditingSuggestionText(event.target.value)}
                          className="min-h-[88px] text-sm"
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSuggestionId(suggestion.id);
                            setEditingSuggestionText(suggestion.text);
                          }}
                          className="w-full rounded-md text-left text-sm leading-relaxed text-foreground transition-colors hover:text-foreground/80"
                        >
                          {suggestion.text}
                        </button>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {isEditing ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              updateMutation.mutate({
                                suggestionId: suggestion.id,
                                text: editingSuggestionText,
                              })
                            }
                            disabled={updateMutation.isPending}
                            className="h-8 text-xs"
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingSuggestionId(null);
                              setEditingSuggestionText("");
                            }}
                            className="h-8 text-xs"
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingSuggestionId(suggestion.id);
                            setEditingSuggestionText(suggestion.text);
                          }}
                          className="h-8 text-xs"
                        >
                          Edit
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeMutation.mutate(suggestion.id)}
                        disabled={removeMutation.isPending}
                        className="h-8 text-xs text-destructive hover:text-destructive"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {isAddFormVisible ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-background px-4 py-3 space-y-3">
            <Textarea
              value={newSuggestionText}
              onChange={(event) => setNewSuggestionText(event.target.value)}
              className="min-h-[88px] text-sm"
              placeholder="Add guidance for every generated report"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsAddFormVisible(false);
                  setNewSuggestionText("");
                }}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => addMutation.mutate(newSuggestionText)}
                disabled={addMutation.isPending || newSuggestionText.trim().length === 0}
                className="text-xs"
              >
                Add note
              </Button>
            </div>
          </div>
        ) : null}

        <Button
          type="button"
          variant="outline"
          onClick={() => setIsAddFormVisible(true)}
          disabled={!canAddMore}
          className="w-full"
        >
          {canAddMore ? "Add guidance note" : "Maximum 10 guidance notes reached"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Upload & analyse form ────────────────────────────────────────────────────

function AnalyseForm({ onDone }: { onDone: () => void }) {
  const [files, setFiles] = useState<
    Array<{ name: string; content: string }>
  >([]);
  const [prescriptiveness, setPrescriptiveness] =
    useState<ReportTemplatePrescriptiveness>("moderate");
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [analysed, setAnalysed] = useState<AnalysedTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const queryClient = useQueryClient();

  const ALLOWED_EXTENSIONS = [".txt", ".md", ".csv", ".pdf"];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? []);
      const loaded: Array<{ name: string; content: string }> = [];
      const errors: string[] = [];

      for (const file of selected) {
        // Validate file extension
        const extension = "." + file.name.split(".").pop()?.toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(extension)) {
          errors.push(
            `${file.name}: unsupported file type. Allowed types: ${ALLOWED_EXTENSIONS.join(", ")}`
          );
          continue;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          errors.push(
            `${file.name}: file too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`
          );
          continue;
        }

        try {
          const text = await file.text();
          loaded.push({ name: file.name, content: text });
        } catch {
          errors.push(`${file.name}: could not read file`);
        }
      }

      // Show any validation errors
      errors.forEach((error) => toast.error(error));

      if (loaded.length > 0) {
        setFiles((prev) => [...prev, ...loaded]);
        setAnalysed(null);
        toast.success(`Added ${loaded.length} file(s)`);
        if (loaded.length < selected.length) {
          toast.info(`Loaded ${loaded.length} of ${selected.length} files`);
        }
      }
    },
    []
  );

  const handleAnalyse = useCallback(async () => {
    if (files.length === 0) return;

    setIsAnalysing(true);
    try {
      const response = await fetch("/api/templates/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          example_documents: files.map((f) => ({
            file_name: f.name,
            content: f.content,
          })),
          prescriptiveness,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          (err as { detail?: string }).detail ?? "Analysis failed"
        );
      }

      const result = (await response.json()) as AnalysedTemplate;
      setAnalysed(result);
      setTemplateName(result.name);
      toast.success("Template analysed successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to analyse examples"
      );
    } finally {
      setIsAnalysing(false);
    }
  }, [files, prescriptiveness]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!analysed) return;
      await createReportTemplate({
        name: templateName || analysed.name,
        description: analysed.description,
        sections: analysed.sections,
        styleNotes: analysed.style_notes,
        prescriptiveness,
        sourceFileNames: files.map((f) => f.name),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-templates"] });
      toast.success("Template saved and activated");
      onDone();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to save template");
    },
  });

  return (
    <div className="space-y-6">
      {/* File upload */}
      <div className="space-y-2">
        <Label htmlFor="example-files">
          Upload example reports{" "}
          <span className="text-muted-foreground font-normal">(plain text, Markdown, CSV, or PDF text)</span>
        </Label>
        <input
          id="example-files"
          type="file"
          accept=".txt,.md,.csv,.pdf"
          multiple
          onChange={handleFileChange}
          className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border file:border-border file:bg-muted/40 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-muted/60"
        />
        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {files.map((f, idx) => (
                <Badge key={`${f.name}-${idx}`} variant="outline" className="text-[10px] flex items-center gap-1">
                  {f.name}
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                    className="ml-1 hover:text-destructive"
                    title="Remove file"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFiles([])}
              className="text-xs text-muted-foreground h-6"
            >
              Clear all files
            </Button>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Upload the text from your example reports (.txt, .md, .csv, or .pdf). 
          For PDFs, copy and paste the text into a .txt or .md file first. 
          You can upload multiple files to create a more robust template.
        </p>
      </div>

      {/* Prescriptiveness */}
      <PrescriptivenessSelector
        value={prescriptiveness}
        onChange={setPrescriptiveness}
      />

      {/* Analyse button */}
      <Button
        onClick={handleAnalyse}
        disabled={files.length === 0 || isAnalysing}
        className="w-full"
      >
        {isAnalysing ? "Analysing…" : "Analyse examples"}
      </Button>

      {/* Results */}
      {analysed && (
        <div className="space-y-4 rounded-lg border border-border/60 bg-muted/5 p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Analysed Template</h3>
              <Badge variant="outline" className="text-[10px]">
                {analysed.sections.length} sections
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{analysed.description}</p>

            {/* Editable name */}
            <div className="space-y-1">
              <Label className="text-xs">Template name</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Section previews */}
          <div className="space-y-2">
            {analysed.sections.map((section, i) => (
              <SectionPreview key={i} section={section} index={i} />
            ))}
          </div>

          {/* Style notes */}
          {(analysed.style_notes.tone ||
            analysed.style_notes.person ||
            analysed.style_notes.formatting_notes) && (
            <div className="rounded-lg border border-border/40 bg-muted/5 px-4 py-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Style Notes
              </p>
              {analysed.style_notes.tone && (
                <p className="text-xs">
                  <span className="font-medium">Tone:</span> {analysed.style_notes.tone}
                </p>
              )}
              {analysed.style_notes.person && (
                <p className="text-xs">
                  <span className="font-medium">Person:</span>{" "}
                  {analysed.style_notes.person}
                </p>
              )}
              {analysed.style_notes.formatting_notes && (
                <p className="text-xs">
                  <span className="font-medium">Formatting:</span>{" "}
                  {analysed.style_notes.formatting_notes}
                </p>
              )}
            </div>
          )}

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full"
          >
            {saveMutation.isPending ? "Saving…" : "Save & activate template"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ReportTemplatePanel() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState<"none" | "analyse" | "builder">("none");
  const [builderTemplate, setBuilderTemplate] = useState<ReportTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["report-templates"],
    queryFn: () => listReportTemplates(),
  });

  const activeTemplate = templates.find((t) => t.is_active) ?? null;

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => updateReportTemplate({ id, isActive: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-templates"] });
      toast.success("Template deactivated");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to deactivate template");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReportTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-templates"] });
      toast.success("Template deleted");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete template");
    },
  });

  const builderSaveMutation = useMutation({
    mutationFn: (params: Parameters<typeof saveBuilderTemplate>[0]) =>
      saveBuilderTemplate(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-templates"] });
      setShowForm("none");
      setBuilderTemplate(null);
      toast.success("Template saved");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to save template");
    },
  });

  const openBuilder = useCallback(
    (template: ReportTemplate | null) => {
      setBuilderTemplate(template);
      setShowForm("builder");
    },
    []
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold">Report Template</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload example reports you&apos;ve written previously. The AI will analyse their
          structure and style, then use that as a template when generating future reports.
          Supported formats: plain text (.txt), Markdown (.md), CSV (.csv), and PDF text.
          Only one template can be active at a time.
        </p>
      </div>

      {/* Active template */}
      {isLoading ? (
        <div className="h-24 rounded-lg border border-border/50 bg-muted/10 animate-pulse" />
      ) : activeTemplate ? (
        <div className="space-y-4">
          <ActiveTemplateCard
            template={activeTemplate}
            onDeactivate={() => deactivateMutation.mutate(activeTemplate.id)}
            onDelete={() => deleteMutation.mutate(activeTemplate.id)}
            onEditInBuilder={() => openBuilder(activeTemplate)}
          />
          <GenerationGuidanceCard template={activeTemplate} />
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-sm font-medium text-foreground">No active template</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload example reports to generate a custom template.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Add / replace template */}
      {showForm === "none" ? (
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowForm("analyse")}
            className="flex-1"
          >
            {activeTemplate ? "Replace template" : "Create from examples"}
          </Button>
          <Button
            variant="outline"
            onClick={() => openBuilder(null)}
            className="flex-1"
          >
            Build from scratch
          </Button>
        </div>
      ) : showForm === "analyse" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {activeTemplate ? "Replace template" : "Create template from examples"}
            </CardTitle>
            <CardDescription>
              Upload 1–3 example reports. The AI will analyse their structure and generate
              a template. You can review it before saving.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnalyseForm onDone={() => setShowForm("none")} />
          </CardContent>
        </Card>
      ) : showForm === "builder" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {builderTemplate ? "Edit template" : "Build report template"}
            </CardTitle>
            <CardDescription>
              Select, order, and configure the sections for your report template.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReportBuilder
              template={builderTemplate}
              onSave={(params) => builderSaveMutation.mutate(params)}
              onCancel={() => {
                setShowForm("none");
                setBuilderTemplate(null);
              }}
              isSaving={builderSaveMutation.isPending}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Past templates */}
      {templates.filter((t) => !t.is_active).length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Inactive Templates
          </h3>
          <div className="space-y-2">
            {templates
              .filter((t) => !t.is_active)
              .map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/5 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    {t.description && (
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs"
                      onClick={() => {
                        void updateReportTemplate({ id: t.id, isActive: true })
                          .then(() => {
                            queryClient.invalidateQueries({ queryKey: ["report-templates"] });
                            toast.success("Template activated");
                          })
                          .catch((error) => {
                            toast.error(
                              error instanceof Error ? error.message : "Failed to activate template"
                            );
                          });
                      }}
                    >
                      Activate
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(t.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
