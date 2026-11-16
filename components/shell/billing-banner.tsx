"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { isReadOnly, readOnlyMessage } from "@/convex/lib/billing";
import { useViewer } from "./viewer";

/** Read-only mode (trial ended, subscription lapsed): why, and who can fix it. */
export function BillingBanner() {
  const status = useQuery(api.billing.status);
  const isAdmin = useViewer().member.role === "admin";
  const pathname = usePathname();
  // The Plan page already says it to admins, next to the plans.
  if (!status || !isReadOnly(status.state) || (isAdmin && pathname === "/configuracion/plan")) return null;

  return (
    <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-lilac px-4 py-3 text-sm lg:px-8">
      <span className="font-medium">{readOnlyMessage(status)}</span>
      {isAdmin ? (
        <Link href="/configuracion/plan" className="font-medium text-plum underline underline-offset-4">
          Ver planes
        </Link>
      ) : (
        <span className="text-ink-soft">Pide a quien administra el negocio que elija un plan.</span>
      )}
    </div>
  );
}
