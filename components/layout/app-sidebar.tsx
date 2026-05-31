"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Collapsible from "@radix-ui/react-collapsible";
import { FlaskConical } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useDigitalInterviewUnreadCount } from "@/hooks/use-digital-interviews";

const mainNavItems = [
  { title: "All Meetings", href: "/meetings" },
  { title: "Consultations", href: "/consultations" },
];

const settingsSubItems = [
  { title: "General", href: "/settings" },
  { title: "Accessibility", href: "/settings/accessibility" },
  { title: "Billing", href: "/settings/billing" },
  { title: "AI Personalisation", href: "/settings/ai-personalisation" },
  { title: "Integrations", href: "/settings/integrations" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const unreadCountQuery = useDigitalInterviewUnreadCount();
  const unreadCount = unreadCountQuery.data ?? 0;
  const isInMeetings = pathname.startsWith("/meetings");
  const isInConsultations = pathname.startsWith("/consultations");
  const isInSettings = pathname.startsWith("/settings");

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <Link href="/dashboard" className="text-base font-semibold tracking-tight">
          ConsultantPlatform
        </Link>
      </SidebarHeader>
      <Separator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith("/dashboard")}>
                  <Link href="/dashboard">Dashboard</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isInConsultations}>
                  <Link href="/consultations">Consultations</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isInMeetings}>
                  <Link href="/meetings">All Meetings</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith("/research")}>
                  <Link href="/research" className="flex items-center gap-2">
                    <span>Research</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

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

              <div className="border-t border-border/50 my-2 pt-2">
                <p className="text-xs text-muted-foreground/70 px-4 py-2 font-medium">Experimental</p>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname.startsWith("/digital-interviews")}>
                      <Link href="/digital-interviews">
                        <span className="flex w-full items-center justify-between gap-2">
                          <span>Digital Interviews</span>
                          {unreadCount > 0 ? (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted-foreground px-1.5 text-[10px] font-medium text-background">
                              {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </div>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-4 py-2">
        <p className="text-xs text-muted-foreground">v0.1.0</p>
      </SidebarFooter>
    </Sidebar>
  );
}
