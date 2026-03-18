"use client";

import type {
  ConsultationReportData,
  IncludedThemeSelection,
  ReportThemeReference,
} from "@/lib/actions/reports";
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
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground/85">{title}</p>
      {themes.length > 0 ? (
        <div className="space-y-2">
          {themes.map((theme) => (
            <div
              key={theme.key}
              className="rounded-md border border-border/70 bg-background p-3"
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
        <p className="rounded-md border border-dashed border-border/70 bg-background/60 p-3 text-sm text-muted-foreground">
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
    <Card className="border-border/70 bg-muted/10">
      <CardHeader>
        <CardTitle>Consultation Report Context</CardTitle>
        <CardDescription>
          Provenance-aware theme context used for round summaries, evidence
          emails, and report surfaces.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground/85">
            Included in next draft
          </p>
          {report.includedThemes.length > 0 ? (
            <div className="space-y-2">
              {report.includedThemes.map((theme) => (
                <div
                  key={theme.label}
                  className="rounded-md border border-border/70 bg-background p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{theme.label}</p>
                    {theme.sourceKinds.includes("consultation") ? (
                      <Badge variant="outline">Consultation</Badge>
                    ) : null}
                    {theme.sourceKinds.includes("round") ? (
                      <Badge variant="outline">Round</Badge>
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
            <p className="rounded-md border border-dashed border-border/70 bg-background/60 p-3 text-sm text-muted-foreground">
              No accepted themes are available for the next draft yet.
            </p>
          )}
        </div>

        <ThemeSection
          title="Consultation themes"
          empty="No accepted consultation themes yet."
          themes={report.consultationThemes}
        />

        <ThemeSection
          title={report.roundLabel ? `Round themes from ${report.roundLabel}` : "Round themes"}
          empty="No accepted round themes are available yet."
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
                  className="rounded-md border border-destructive/20 bg-background/80 p-3"
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
