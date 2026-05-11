// @vitest-environment jsdom

// Make requestAnimationFrame synchronous so quote insertion tests can assert
// immediately without needing fake timers or act() wrappers.
global.requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 0; };

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReportArtifactDetail } from "@/types/report-artifact";

const insertMarkdown = vi.fn();
const getMarkdown = vi.fn(() => "Existing report");

vi.mock("@mdxeditor/editor", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const MockMDXEditor = React.forwardRef((_props: unknown, ref) => {
    React.useImperativeHandle(ref, () => ({
      getMarkdown,
      setMarkdown: vi.fn(),
      insertMarkdown,
    }));
    return <div data-testid="mock-report-editor" />;
  });
  MockMDXEditor.displayName = "MockMDXEditor";

  return {
    MDXEditor: MockMDXEditor,
    headingsPlugin: vi.fn(),
    listsPlugin: vi.fn(),
    markdownShortcutPlugin: vi.fn(),
    quotePlugin: vi.fn(),
    toolbarPlugin: vi.fn(),
    BoldItalicUnderlineToggles: () => null,
    BlockTypeSelect: () => null,
    ListsToggle: () => null,
    Separator: () => null,
    UndoRedo: () => null,
  };
});

vi.mock("@/components/reports/report-quote-library", () => ({
  ReportQuoteLibrary: ({ onInsertMarkdown }: { onInsertMarkdown: (markdown: string) => void }) => (
    <button type="button" onClick={() => onInsertMarkdown("> Inserted quote")}>
      Insert quote from library
    </button>
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
  },
}));

vi.mock("@/hooks/use-reports", () => ({
  useReportArtifact: vi.fn(),
  useReportArtifactVersions: vi.fn(),
}));

vi.mock("@/hooks/use-ai-preferences", () => ({
  useAIPreferences: vi.fn(),
}));

import { ReportEditor } from "@/components/reports/report-view";

function reportFixture(): ReportArtifactDetail {
  return {
    id: "report-1",
    artifactType: "report",
    title: "Report",
    content: "Existing report",
    roundId: "round-1",
    roundLabel: "Round 1",
    roundDescription: null,
    generatedAt: "2026-05-08T00:00:00.000Z",
    updatedAt: "2026-05-08T00:00:00.000Z",
    inputSnapshot: {
      accepted_consultation_themes: [],
      supporting_meeting_themes: [],
    },
    consultationTitles: ["Operations workshop"],
    consultations: [
      {
        id: "meeting-1",
        title: "Operations workshop",
        date: "2026-05-08",
        people: ["Riley"],
        meetingTypeLabel: "Workshop",
        participantLabels: ["Riley"],
      },
    ],
    acceptedThemeCount: 0,
    supportingThemeCount: 0,
    versionNumber: 1,
    totalVersions: 1,
    auditSummary: [],
    draftThemeGroups: [],
  };
}

describe("ReportEditor quote insertion", () => {
  it("inserts library markdown through the existing MDX editor ref", () => {
    render(
      <ReportEditor
        report={reportFixture()}
        anonymousMode={false}
        onExit={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /insert quote from library/i }));

    expect(insertMarkdown).toHaveBeenCalledWith("\n\n> Inserted quote\n\n");
  });
});
