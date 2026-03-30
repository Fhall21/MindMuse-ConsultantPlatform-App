// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuditExportsPanel } from "@/components/audit/audit-exports-panel";

const exportAuditMock = vi.fn();
const resetMock = vi.fn();

vi.mock("@/hooks/use-consultations", () => ({
  useConsultations: () => ({
    data: [
      { id: "consultation-1", label: "North depot meeting" },
      { id: "consultation-2", label: "R2 follow-up" },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-audit-export", () => ({
  useAuditExportUsers: () => ({
    data: [
      { id: "user-1", label: "Jordan Smith" },
      { id: "user-2", label: "A. Patel" },
    ],
    isLoading: false,
    error: null,
  }),
  useAuditExport: () => ({
    exportAudit: exportAuditMock,
    isPending: false,
    error: null,
    lastExport: null,
    reset: resetMock,
  }),
}));

describe("AuditExportsPanel", () => {
  it("renders the live Site Actions export and the compliance placeholder", () => {
    render(<AuditExportsPanel />);

    expect(screen.getByText("Site Actions Audit Export")).toBeInTheDocument();
    expect(screen.getByText("Compliance Audit Export")).toBeInTheDocument();
    expect(screen.getByText("In development")).toBeInTheDocument();
    expect(screen.getByText(/placeholder content only/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeInTheDocument();
  });
});
