"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LiteraturePanel } from "@/components/research/literature-panel";

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

        <TabsContent value="literature" className="rounded-xl border p-6">
          <LiteraturePanel />
        </TabsContent>

        <TabsContent value="analysis" className="rounded-xl border p-6">
          <div className="space-y-2">
            <h2 className="text-lg font-medium">Data Analysis</h2>
            <p className="text-sm text-muted-foreground">
              Edison-backed data analysis will appear here.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
