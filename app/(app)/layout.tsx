import { redirect } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { UserNav } from "@/components/layout/user-nav";
import { Separator } from "@/components/ui/separator";
import { getAuthSession, getSessionDisplayName } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-12 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <div className="flex-1" />
          <UserNav
            email={session.user.email}
            displayName={getSessionDisplayName(session)}
          />
        </header>
        <main className="flex-1 px-4 py-5 sm:px-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
