// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ReportsPage from "@/app/(app)/reports/page";

vi.mock("@/components/reports/report-generation-card", () => ({
  ReportGenerationCard: () => <div>Report generation card</div>,
}));

vi.mock("@/components/reports/report-list", () => ({
  ReportList: () => <div>Generated outputs list</div>,
}));

vi.mock("@/components/settings/report-template/report-template-panel", () => ({
  ReportTemplatePanel: () => <div>Template panel</div>,
}));

vi.mock("@/components/audit/audit-exports-panel", () => ({
  AuditExportsPanel: () => <div>Audit exports panel</div>,
}));

describe("ReportsPage", () => {
  it("moves export content into the new Audit Exports tab", () => {
    render(<ReportsPage />);

    expect(screen.getByText("Report generation card")).toBeInTheDocument();
    expect(screen.getByText("Generated outputs list")).toBeInTheDocument();
    expect(screen.queryByText("Audit exports panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Audit Exports" }));

    expect(screen.getByText("Audit exports panel")).toBeInTheDocument();
    expect(screen.queryByText("Report generation card")).not.toBeInTheDocument();
    expect(screen.queryByText("Generated outputs list")).not.toBeInTheDocument();
  });
});
