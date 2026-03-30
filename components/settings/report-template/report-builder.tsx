"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCenter,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Plus, Save, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BuilderSectionRow } from "./builder-section-row";
import { BuilderAvailableSection } from "./builder-available-section";
import { BuilderPreview } from "./builder-preview";
import {
  PREDEFINED_SECTIONS,
  getPredefinedSection,
  getDefaultSections,
  sectionConfigToTemplateSection,
} from "@/lib/report-sections-registry";
import type {
  BuilderConfig,
  BuilderSectionConfig,
  CustomSectionDef,
  ReportTemplate,
  ReportTemplateStyleNotes,
  ReportTemplatePrescriptiveness,
} from "@/types/db";

const MAX_SECTIONS = 10;

interface ReportBuilderProps {
  template?: ReportTemplate | null;
  onSave: (params: {
    templateId?: string;
    name: string;
    description: string | null;
    sections: ReturnType<typeof sectionConfigToTemplateSection>[];
    styleNotes: ReportTemplateStyleNotes;
    prescriptiveness: ReportTemplatePrescriptiveness;
    builderConfig: BuilderConfig;
  }) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

function initFromTemplate(template: ReportTemplate | null | undefined): {
  selectedSections: BuilderSectionConfig[];
  customSections: CustomSectionDef[];
  name: string;
  description: string;
} {
  if (!template) {
    return {
      selectedSections: getDefaultSections(),
      customSections: [],
      name: "",
      description: "",
    };
  }

  // If template has builder config, use it directly
  const bc = template.builder_config;
  if (bc.sections.length > 0) {
    return {
      selectedSections: [...bc.sections].sort(
        (a, b) => a.position - b.position
      ),
      customSections: bc.customSections,
      name: template.name,
      description: template.description ?? "",
    };
  }

  // AI-generated template — convert sections to builder config
  const converted: BuilderSectionConfig[] = template.sections.map(
    (section, index) => {
      // Try to match to a predefined section by heading
      const predefined = PREDEFINED_SECTIONS.find(
        (p) =>
          p.heading.toLowerCase() === section.heading.toLowerCase()
      );

      return {
        sectionId: predefined?.id ?? `custom-${crypto.randomUUID()}`,
        depth: section.depth ?? predefined?.defaultDepth ?? "detailed",
        note: section.section_note ?? null,
        position: index,
      };
    }
  );

  // Extract custom sections (ones that didn't match predefined)
  const customs: CustomSectionDef[] = template.sections
    .map((section, index) => {
      const config = converted[index];
      if (getPredefinedSection(config.sectionId)) return null;
      return {
        id: config.sectionId,
        heading: section.heading,
        description: section.purpose,
      };
    })
    .filter((s): s is CustomSectionDef => s !== null);

  return {
    selectedSections: converted,
    customSections: customs,
    name: template.name,
    description: template.description ?? "",
  };
}

export function ReportBuilder({
  template,
  onSave,
  onCancel,
  isSaving,
}: ReportBuilderProps) {
  const init = useMemo(() => initFromTemplate(template), [template]);

  const [selectedSections, setSelectedSections] = useState<
    BuilderSectionConfig[]
  >(init.selectedSections);
  const [customSections, setCustomSections] = useState<CustomSectionDef[]>(
    init.customSections
  );
  const [name, setName] = useState(init.name);
  const [description, setDescription] = useState(init.description);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customHeading, setCustomHeading] = useState("");
  const [customDescription, setCustomDescription] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 4 },
    })
  );

  const selectedIds = useMemo(
    () => new Set(selectedSections.map((s) => s.sectionId)),
    [selectedSections]
  );

  const availablePredefined = useMemo(
    () => PREDEFINED_SECTIONS.filter((s) => !selectedIds.has(s.id)),
    [selectedIds]
  );

  const atLimit = selectedSections.length >= MAX_SECTIONS;

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSelectedSections((prev) => {
      const oldIndex = prev.findIndex((s) => s.sectionId === active.id);
      const newIndex = prev.findIndex((s) => s.sectionId === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex).map((s, i) => ({
        ...s,
        position: i,
      }));
    });
  }, []);

  const addSection = useCallback(
    (sectionId: string, depth: "brief" | "detailed" = "detailed") => {
      if (atLimit) return;
      setSelectedSections((prev) => [
        ...prev,
        {
          sectionId,
          depth,
          note: null,
          position: prev.length,
        },
      ]);
    },
    [atLimit]
  );

  const removeSection = useCallback((sectionId: string) => {
    setSelectedSections((prev) =>
      prev
        .filter((s) => s.sectionId !== sectionId)
        .map((s, i) => ({ ...s, position: i }))
    );
  }, []);

  const updateDepth = useCallback(
    (sectionId: string, depth: "brief" | "detailed") => {
      setSelectedSections((prev) =>
        prev.map((s) => (s.sectionId === sectionId ? { ...s, depth } : s))
      );
    },
    []
  );

  const updateNote = useCallback(
    (sectionId: string, note: string | null) => {
      setSelectedSections((prev) =>
        prev.map((s) => (s.sectionId === sectionId ? { ...s, note } : s))
      );
    },
    []
  );

  const addCustomSection = useCallback(() => {
    if (!customHeading.trim() || atLimit) return;

    const id = `custom-${crypto.randomUUID()}`;
    const newCustom: CustomSectionDef = {
      id,
      heading: customHeading.trim(),
      description: customDescription.trim(),
    };

    setCustomSections((prev) => [...prev, newCustom]);
    addSection(id);
    setCustomHeading("");
    setCustomDescription("");
    setShowCustomForm(false);
  }, [customHeading, customDescription, atLimit, addSection]);

  const handleSave = useCallback(() => {
    if (!name.trim()) return;

    const builderConfig: BuilderConfig = {
      sections: selectedSections,
      customSections,
    };

    const sections = selectedSections.map((config) =>
      sectionConfigToTemplateSection(config, customSections)
    );

    onSave({
      templateId: template?.id,
      name: name.trim(),
      description: description.trim() || null,
      sections,
      styleNotes: template?.style_notes ?? {
        tone: null,
        person: null,
        formatting_notes: null,
      },
      prescriptiveness: template?.prescriptiveness ?? "moderate",
      builderConfig,
    });
  }, [
    name,
    description,
    selectedSections,
    customSections,
    template,
    onSave,
  ]);

  const customSectionMap = useMemo(
    () => new Map(customSections.map((s) => [s.id, s])),
    [customSections]
  );

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const activeDragSection = activeDragId
    ? selectedSections.find((s) => s.sectionId === activeDragId)
    : null;
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Template name + description */}
      <div className="space-y-2">
        <Input
          placeholder="Template name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left panel — Available sections */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground">
              Available Sections
            </h4>
            <Badge variant="secondary" className="text-[10px]">
              {selectedSections.length}/{MAX_SECTIONS}
            </Badge>
          </div>

          <div className="space-y-1.5">
            {availablePredefined.map((section) => (
              <BuilderAvailableSection
                key={section.id}
                section={section}
                disabled={atLimit}
                onAdd={() => addSection(section.id, section.defaultDepth)}
              />
            ))}
          </div>

          {/* Custom section form */}
          {showCustomForm ? (
            <div className="space-y-2 rounded-md border p-3">
              <Input
                placeholder="Section heading"
                value={customHeading}
                onChange={(e) => setCustomHeading(e.target.value)}
                autoFocus
              />
              <Textarea
                placeholder="Section description"
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                className="min-h-[3rem] text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="xs"
                  onClick={addCustomSection}
                  disabled={!customHeading.trim() || atLimit}
                >
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setShowCustomForm(false);
                    setCustomHeading("");
                    setCustomDescription("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={atLimit}
              onClick={() => setShowCustomForm(true)}
            >
              <Plus className="size-3.5" />
              Add custom section
            </Button>
          )}
        </div>

        {/* Right panel — Your report structure */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Your Report Structure
          </h4>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(event) => setActiveDragId(String(event.active.id))}
            onDragEnd={(event) => {
              setActiveDragId(null);
              handleDragEnd(event);
            }}
            onDragCancel={() => setActiveDragId(null)}
          >
            <SortableContext
              items={selectedSections.map((s) => s.sectionId)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1.5 min-h-[4rem]">
                {selectedSections.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Add sections from the left to build your report.
                  </p>
                )}
                {selectedSections.map((config) => (
                  <BuilderSectionRow
                    key={config.sectionId}
                    config={config}
                    customHeading={
                      customSectionMap.get(config.sectionId)?.heading
                    }
                    onDepthChange={(depth) =>
                      updateDepth(config.sectionId, depth)
                    }
                    onNoteChange={(note) =>
                      updateNote(config.sectionId, note)
                    }
                    onRemove={() => removeSection(config.sectionId)}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeDragSection && (
                <div className="rounded-md border bg-card px-3 py-2 shadow-lg opacity-90">
                  <span className="text-sm font-medium">
                    {getPredefinedSection(activeDragSection.sectionId)
                      ?.heading ??
                      customSectionMap.get(activeDragSection.sectionId)
                        ?.heading ??
                      "Section"}
                  </span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t">
        <Button
          onClick={handleSave}
          disabled={
            !name.trim() || selectedSections.length === 0 || isSaving
          }
        >
          <Save className="size-3.5" />
          {isSaving ? "Saving..." : "Save & Activate"}
        </Button>
        <Button
          variant="outline"
          onClick={() => setPreviewOpen(true)}
          disabled={selectedSections.length === 0}
        >
          <Eye className="size-3.5" />
          Preview
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          <X className="size-3.5" />
          Cancel
        </Button>
      </div>

      <BuilderPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        name={name}
        sections={selectedSections}
        customSections={customSections}
        styleNotes={template?.style_notes ?? { tone: null, person: null, formatting_notes: null }}
        prescriptiveness={template?.prescriptiveness ?? "moderate"}
        suggestions={template?.suggestions ?? []}
      />
    </div>
  );
}
