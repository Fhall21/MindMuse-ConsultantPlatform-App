"use client";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { getPredefinedSection } from "@/lib/report-sections-registry";
import type {
  BuilderSectionConfig,
  CustomSectionDef,
  ReportTemplateStyleNotes,
  ReportTemplatePrescriptiveness,
} from "@/types/db";

interface BuilderPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  sections: BuilderSectionConfig[];
  customSections: CustomSectionDef[];
  styleNotes: ReportTemplateStyleNotes;
  prescriptiveness: ReportTemplatePrescriptiveness;
  suggestions: Array<{ id: string; text: string }>;
}

export function BuilderPreview({
  open,
  onOpenChange,
  name,
  sections,
  customSections,
  styleNotes,
  prescriptiveness,
  suggestions,
}: BuilderPreviewProps) {
  const customMap = new Map(customSections.map((s) => [s.id, s]));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Template Preview</SheetTitle>
          <SheetDescription>
            {name || "Untitled template"} — {sections.length} section
            {sections.length !== 1 ? "s" : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Prescriptiveness */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Prescriptiveness:</span>
            <Badge variant="outline" className="text-[10px] capitalize">
              {prescriptiveness}
            </Badge>
          </div>

          {/* Sections */}
          <div className="space-y-3">
            {sections.map((config, index) => {
              const predefined = getPredefinedSection(config.sectionId);
              const custom = customMap.get(config.sectionId);
              const heading =
                predefined?.heading ?? custom?.heading ?? "Untitled Section";
              const purpose =
                predefined?.defaultPurpose ?? custom?.description ?? "";

              return (
                <div
                  key={config.sectionId}
                  className="rounded-lg border border-border/50 bg-muted/5 px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{heading}</p>
                        <Badge
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {config.depth}
                        </Badge>
                      </div>
                      {purpose && (
                        <p className="text-xs text-muted-foreground">
                          {purpose}
                        </p>
                      )}
                      {config.note && (
                        <p className="mt-1 text-xs italic text-foreground/70 border-l-2 border-border/60 pl-2">
                          {config.note}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Style notes */}
          {(styleNotes.tone || styleNotes.person || styleNotes.formatting_notes) && (
            <div className="rounded-lg border border-border/40 bg-muted/5 px-4 py-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Style Notes
              </p>
              {styleNotes.tone && (
                <p className="text-xs text-foreground/80">
                  <span className="font-medium">Tone:</span> {styleNotes.tone}
                </p>
              )}
              {styleNotes.person && (
                <p className="text-xs text-foreground/80">
                  <span className="font-medium">Person:</span> {styleNotes.person}
                </p>
              )}
              {styleNotes.formatting_notes && (
                <p className="text-xs text-foreground/80">
                  <span className="font-medium">Formatting:</span>{" "}
                  {styleNotes.formatting_notes}
                </p>
              )}
            </div>
          )}

          {/* Global suggestions */}
          {suggestions.length > 0 && (
            <div className="rounded-lg border border-border/40 bg-muted/5 px-4 py-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Generation Guidance
              </p>
              <ul className="space-y-1">
                {suggestions.map((s) => (
                  <li key={s.id} className="text-xs text-foreground/80">
                    &bull; {s.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
