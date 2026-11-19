"use client";

import { useAction, useConvex, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/components/forms/error-message";

const tables = ["members", "invitations", "clients", "treatments", "appointments", "timeBlocks", "cases", "sessions", "followUps", "payments", "uploads", "policies", "clientAuthorizations", "processingAcceptances", "checkoutAcceptances", "subscriptions"] as const;

export function DataRecoveryTools() {
  const convex = useConvex();
  const status = useQuery(api.dataLifecycle.status, {});
  const close = useAction(api.dataLifecycle.close);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [urls, setUrls] = useState<Record<string, string>>({});

  async function download() {
    setBusy(true);
    try {
      const data: Record<string, unknown[]> = {};
      for (const table of tables) {
        data[table] = [];
        let cursor: string | null = null;
        do {
          const page: { page: unknown[]; isDone: boolean; continueCursor: string } = await convex.query(api.dataLifecycle.exportPage, { table, paginationOpts: { cursor, numItems: 100 } });
          data[table].push(...page.page);
          cursor = page.isDone ? null : page.continueCursor;
        } while (cursor);
      }
      const links: Record<string, string> = {};
      const uploads = data.uploads as { key: string }[];
      for (let i = 0; i < uploads.length; i += 50) Object.assign(links, await convex.query(api.dataLifecycle.fileUrls, { keys: uploads.slice(i, i + 50).map((item) => item.key) }));
      setUrls(links);
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), organization: status?.org, data }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "datos-cosmela.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  }

  async function confirmClose() {
    setBusy(true);
    try { await close({ confirmation }); toast.success("Negocio cerrado"); }
    catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Button variant="secondary" className="self-start" disabled={busy || !status} onClick={() => void download()}>
          Exportar datos
        </Button>
        {Object.keys(urls).length > 0 && (
          <div className="flex max-w-[70ch] flex-col gap-2">
            <p className="text-ink-soft">Los enlaces vencen en cinco minutos. Vuelve a exportar para obtener enlaces nuevos.</p>
            <ul className="flex flex-col">
              {Object.entries(urls).map(([key, url]) => (
                <li key={key}>
                  <a className="inline-flex min-h-11 items-center text-plum underline underline-offset-4 [overflow-wrap:anywhere]" href={url} target="_blank" rel="noreferrer">
                    {key}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {!status?.closureConfirmedAt && (
        <div className="flex max-w-[70ch] flex-col gap-3 border-t border-line pt-8">
          <h3 className="font-medium">Cerrar el negocio</h3>
          <p className="text-ink-soft">Cancela la renovación antes de cerrar. Tendrás 30 días para exportar tus datos.</p>
          <Label htmlFor="close-confirmation" className="text-base">
            Escribe CERRAR para confirmar
          </Label>
          <Input
            id="close-confirmation"
            className="max-w-xs"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
          <Button variant="destructive" className="self-start" disabled={busy || confirmation !== "CERRAR"} onClick={() => void confirmClose()}>
            Cerrar negocio
          </Button>
        </div>
      )}
    </div>
  );
}
