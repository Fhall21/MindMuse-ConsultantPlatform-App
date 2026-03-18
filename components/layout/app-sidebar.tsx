"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Collapsible from "@radix-ui/react-collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const consultationsSubItems = [
  { title: "All Consultations", href: "/consultations" },
  { title: "Rounds", href: "/consultations/rounds" },
];

const settingsSubItems = [
  { title: "General", href: "/settings" },
  { title: "Accessibility", href: "/settings/accessibility" },
  { title: "Billing", href: "/settings/billing" },
  { title: "Integrations", href: "/settings/integrations" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const isInConsultations = pathname.startsWith("/consultations");
  const isInSettings = pathname.startsWith("/settings");

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          ConsultantPlatform
        </Link>
      </SidebarHeader>
      <Separator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith("/dashboard")}>
                  <Link href="/dashboard">Dashboard</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <Collapsible.Root defaultOpen={isInConsultations} asChild>
                <SidebarMenuItem>
                  <Collapsible.Trigger asChild>
                    <SidebarMenuButton isActive={isInConsultations}>
                      <span className="flex w-full items-center justify-between">
                        <span>Consultations</span>
                        <span className="text-xs text-muted-foreground" aria-hidden>▾</span>
                      </span>
                    </SidebarMenuButton>
                  </Collapsible.Trigger>
                  <Collapsible.Content>
                    <SidebarMenuSub>
                      {consultationsSubItems.map((item) => (
                        <SidebarMenuSubItem key={item.href}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={
                              item.href === "/consultations"
                                ? pathname === "/consultations" ||
                                  (pathname.startsWith("/consultations/") &&
                                    !pathname.startsWith("/consultations/rounds"))
                                : pathname.startsWith(item.href)
                            }
                          >
                            <Link href={item.href}>{item.title}</Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </Collapsible.Content>
                </SidebarMenuItem>
              </Collapsible.Root>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith("/people")}>
                  <Link href="/people">People</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith("/reports")}>
                  <Link href="/reports">Reports</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <Collapsible.Root defaultOpen={isInSettings} asChild>
                <SidebarMenuItem>
                  <Collapsible.Trigger asChild>
                    <SidebarMenuButton isActive={isInSettings}>
                      <span className="flex w-full items-center justify-between">
                        <span>Settings</span>
                        <span className="text-xs text-muted-foreground" aria-hidden>
                          ▾
                        </span>
                      </span>
                    </SidebarMenuButton>
                  </Collapsible.Trigger>
                  <Collapsible.Content>
                    <SidebarMenuSub>
                      {settingsSubItems.map((item) => (
                        <SidebarMenuSubItem key={item.href}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={
                              item.href === "/settings"
                                ? pathname === "/settings"
                                : pathname.startsWith(item.href)
                            }
                          >
                            <Link href={item.href}>{item.title}</Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </Collapsible.Content>
                </SidebarMenuItem>
              </Collapsible.Root>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-4 py-3">
        <p className="text-xs text-muted-foreground">v0.1.0</p>
      </SidebarFooter>
    </Sidebar>
  );
}
