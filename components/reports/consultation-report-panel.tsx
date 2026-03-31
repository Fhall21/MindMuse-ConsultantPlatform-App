"use client";

import type {
  ConsultationReportData,
  IncludedThemeSelection,
  ReportThemeReference,
} from "@/types/report-artifact";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ConsultationReportPanelProps {
  report: ConsultationReportData;
}

function formatProvenance(theme: ReportThemeReference | IncludedThemeSelection) {
  const titles = Array.from(
    new Set(
      theme.provenance
        .map((entry) => entry.consultationTitle)
        .filter((value): value is string => Boolean(value))
    )
  );

  return titles.length > 0 ? titles.join(", ") : "Current consultation";
}

function ThemeSection(props: {
  title: string;
  empty: string;
  themes: ReportThemeReference[];
}) {
  const { title, empty, themes } = props;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground/85">{title}</p>
      {themes.length > 0 ? (
        <div className="space-y-2">
          {themes.map((theme) => (
            <div
              key={theme.key}
              className="rounded-md border border-border/50 bg-muted/5 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{theme.label}</p>
                <Badge variant="outline">
                  {theme.sourceKind === "round" ? "Round theme" : "Consultation theme"}
                </Badge>
                {theme.provenance.some((entry) => entry.isUserAdded) ? (
                  <Badge variant="outline">User added</Badge>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatProvenance(theme)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border/50 bg-muted/10 px-3 py-2.5 text-sm text-muted-foreground">
          {empty}
        </p>
      )}
    </div>
  );
}

export function ConsultationReportPanel({
  report,
}: ConsultationReportPanelProps) {
  return (
    <Card className="border-border/60 bg-muted/5">
      <CardHeader>
        <CardTitle>Consultation Report Context</CardTitle>
        <CardDescription>
          Provenance-aware theme context used for consultation summaries, evidence
          emails, and report surfaces.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground/85">
            Included in next draft
          </p>
          {report.includedThemes.length > 0 ? (
            <div className="space-y-2">
              {report.includedThemes.map((theme) => (
                <div
                  key={theme.label}
                  className="rounded-md border border-border/50 bg-muted/5 px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{theme.label}</p>
                    {theme.sourceKinds.includes("consultation") ? (
                      <Badge variant="outline">Meeting</Badge>
                    ) : null}
                    {theme.sourceKinds.includes("round") ? (
                      <Badge variant="outline">Consultation</Badge>
                    ) : null}
                    {theme.provenance.some((entry) => entry.isUserAdded) ? (
                      <Badge variant="outline">User added</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatProvenance(theme)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border/50 bg-muted/10 px-3 py-2.5 text-sm text-muted-foreground">
              No accepted themes are available for the next draft yet.
            </p>
          )}
        </div>

        <ThemeSection
          title="Meeting themes"
          empty="No accepted meeting themes yet."
          themes={report.consultationThemes}
        />

        <ThemeSection
          title={report.roundLabel ? `Consultation themes from ${report.roundLabel}` : "Consultation themes"}
          empty="No accepted consultation themes are available yet."
          themes={report.roundThemes}
        />

        {report.rejectedThemes.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-sm font-medium text-foreground/85">
              Compliance context
            </p>
            <div className="space-y-2">
              {report.rejectedThemes.map((theme) => (
                <div
                  key={theme.key}
                  className="rounded-md border border-destructive/20 bg-muted/5 px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{theme.label}</p>
                    <Badge variant="destructive">Rejected</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatProvenance(theme)}
                  </p>
                  {theme.rationale ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground/80">
                        Rationale:
                      </span>{" "}
                      {theme.rationale}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
