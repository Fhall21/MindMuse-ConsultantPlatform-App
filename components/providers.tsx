"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { AccessibilityPreferencesSync } from "@/components/settings/accessibility-preferences";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const { data: session, isPending } = authClient.useSession();
  const previousUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (isPending) {
      return;
    }

    const currentUserId = session?.user.id ?? null;

    if (previousUserIdRef.current === undefined) {
      previousUserIdRef.current = currentUserId;
      return;
    }

    if (previousUserIdRef.current !== currentUserId) {
      queryClient.clear();
      previousUserIdRef.current = currentUserId;
    }
  }, [isPending, queryClient, session?.user.id]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AccessibilityPreferencesSync />
        {children}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
