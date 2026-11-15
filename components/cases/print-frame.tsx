"use client";

import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useFileUrls } from "@/components/attention/step-parts";
import { Button } from "@/components/ui/button";
import type { Doc } from "@/convex/_generated/dataModel";
import { consentDate } from "@/convex/lib/consent";
import { formatPhone } from "@/lib/format";

type OrgHeader = Pick<Doc<"orgs">, "name" | "legalName" | "taxId" | "city" | "address" | "whatsapp" | "logoKey">;

/** Print layout: a toolbar on screen, then the business header and the document (browser print → PDF). */
export function PrintFrame({ org, title, children }: { org: OrgHeader; title: string; children: ReactNode }) {
  const router = useRouter();
  const [printedAt] = useState(() => Date.now());
  const logo = useFileUrls([org.logoKey])[org.logoKey ?? ""];
  const legal = [org.legalName && org.legalName !== org.name ? org.legalName : null, org.taxId].filter(Boolean).join(", ");
  const place = [org.address, org.city].filter(Boolean).join(", ");

  return (
    <div className="min-h-dvh bg-white text-ink">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-white px-4 py-3 print:hidden">
        <Button variant="ghost" onClick={() => router.back()}>
          Volver
        </Button>
        <Button onClick={() => window.print()}>
          <Printer strokeWidth={1.75} />
          Imprimir
        </Button>
      </div>
      <main className="mx-auto flex w-full max-w-[800px] flex-col gap-8 px-4 py-8 print:max-w-none print:px-0 print:py-0">
        <header className="flex items-start justify-between gap-6 border-b border-line pb-6">
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-[1.75rem] leading-tight">{org.name}</span>
            {legal && <span className="text-sm text-ink-soft">{legal}</span>}
            {place && <span className="text-sm text-ink-soft">{place}</span>}
            {org.whatsapp && <span className="text-sm text-ink-soft">WhatsApp {formatPhone(org.whatsapp)}</span>}
          </div>
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed R2 URL
            <img src={logo} alt="" className="max-h-16 max-w-40 object-contain" />
          )}
        </header>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[1.75rem] leading-tight">{title}</h1>
          <span className="text-sm text-ink-soft">Impreso el {consentDate(printedAt)}</span>
        </div>
        {children}
      </main>
    </div>
  );
}
