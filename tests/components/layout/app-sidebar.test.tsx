// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSidebar } from "@/components/layout/app-sidebar";

const sidebarState = vi.hoisted(() => ({
  pathname: "/digital-interviews",
  unreadCount: 12,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => sidebarState.pathname,
}));

vi.mock("@/hooks/use-digital-interviews", () => ({
  useDigitalInterviewUnreadCount: () => ({
    data: sidebarState.unreadCount,
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@radix-ui/react-collapsible", () => ({
  Root: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Trigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Content: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => <aside>{children}</aside>,
  SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarFooter: ({ children }: { children: React.ReactNode }) => <footer>{children}</footer>,
  SidebarGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <nav>{children}</nav>,
  SidebarMenuButton: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuSub: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuSubButton: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuSubItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <hr />,
}));

beforeEach(() => {
  sidebarState.pathname = "/digital-interviews";
  sidebarState.unreadCount = 12;
});

describe("AppSidebar", () => {
  it("shows Digital Interviews between Meetings and People with a capped badge", () => {
    const { container } = render(<AppSidebar />);

    const sidebarText = container.textContent?.replace(/\s+/g, " ") ?? "";

    expect(sidebarText.indexOf("Meetings")).toBeLessThan(sidebarText.indexOf("Digital Interviews"));
    expect(sidebarText.indexOf("Digital Interviews")).toBeLessThan(sidebarText.indexOf("People"));
    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("hides the badge when unread count is zero", () => {
    sidebarState.unreadCount = 0;

    render(<AppSidebar />);

    expect(screen.queryByText("9+")).not.toBeInTheDocument();
  });
});