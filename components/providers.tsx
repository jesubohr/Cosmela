"use client";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import { LucideProvider } from "lucide-react";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CookiePreferences } from "@/components/cookie-preferences";
import { AccountLegalGate } from "@/components/legal/account-legal-gate";
import { authClient } from "@/lib/auth-client";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ConvexBetterAuthProvider client={convex} authClient={authClient}>
        <TooltipProvider delayDuration={400}>
          {/* Most icons sit beside 500-weight labels: a fixed 2px stroke at any size (root DESIGN.md). */}
          <LucideProvider strokeWidth={2} nonScalingStroke>
            <AccountLegalGate>{children}</AccountLegalGate>
            <Toaster />
            <CookiePreferences />
          </LucideProvider>
        </TooltipProvider>
      </ConvexBetterAuthProvider>
    </ThemeProvider>
  );
}
