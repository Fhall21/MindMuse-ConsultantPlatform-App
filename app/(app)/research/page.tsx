"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalysisComposer } from "@/components/research/analysis-composer";
import { ResearchComposer } from "@/components/research/research-composer";
import { ResearchSessionList } from "@/components/research/session-list";

export default function ResearchPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Research</h1>
        <p className="text-sm text-muted-foreground">
          Literature search and data analysis workspaces.
        </p>
      </div>

      <Tabs defaultValue="literature">
        <TabsList>
          <TabsTrigger value="literature">Literature</TabsTrigger>
          <TabsTrigger value="analysis">Data Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="literature" className="space-y-6 rounded-xl border p-6">
          <ResearchComposer />
          <ResearchSessionList
            sessionType="literature"
            heading="Previous searches"
            emptyMessage="No searches yet — try a question above."
          />
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6 rounded-xl border p-6">
          <AnalysisComposer />
          <ResearchSessionList
            sessionType="analysis"
            heading="Previous analyses"
            emptyMessage="No analyses yet — upload data and ask a question above."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
