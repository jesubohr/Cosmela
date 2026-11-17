"use client";

import { makeFunctionReference } from "convex/server";
import { useConvex } from "convex/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { disableAnalytics, enableAnalytics } from "@/lib/analytics";
import { LEGAL_VERSION } from "@/lib/legal-documents";

const STORAGE_KEY = "cosmela-cookie-choice";
const YEAR = 365 * 24 * 60 * 60 * 1000;
type Choice = "accepted" | "rejected" | "withdrawn";
type Preference = { receiptId: string; version: string; choice: Choice; timestamp: number; pending?: boolean };
const recordChoice = makeFunctionReference<"mutation", { receiptId: string; version: string; choice: Choice }, null>("legal:recordCookieChoice");

export function openCookiePreferences() {
  window.dispatchEvent(new Event("cosmela-cookie-preferences"));
}

export function CookiePreferences() {
  const convex = useConvex();
  const [open, setOpen] = useState(false);
  const [preference, setPreference] = useState<Preference | null>(null);
  const currentPreference = useRef<Preference | null>(null);

  useEffect(() => {
    let saved: Preference | null = null;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as Preference | null; } catch { /* Ignore invalid storage. */ }
    if (!saved || saved.version !== LEGAL_VERSION || !Number.isFinite(saved.timestamp) || saved.timestamp > Date.now() || Date.now() - saved.timestamp >= YEAR || !["accepted", "rejected", "withdrawn"].includes(saved.choice)) {
      disableAnalytics();
      queueMicrotask(() => setOpen(true));
    } else {
      currentPreference.current = saved;
      queueMicrotask(() => setPreference(saved));
      if (saved.choice === "accepted" && !saved.pending) enableAnalytics();
      else disableAnalytics();
      if (saved.pending) {
        void convex.mutation(recordChoice, { receiptId: saved.receiptId, version: saved.version, choice: saved.choice }).then(() => {
          if (currentPreference.current?.receiptId !== saved.receiptId) return;
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, pending: false })); } catch { /* Storage is optional. */ }
          if (saved.choice === "accepted") enableAnalytics();
        }).catch(() => {});
      }
    }
    const show = () => setOpen(true);
    window.addEventListener("cosmela-cookie-preferences", show);
    return () => window.removeEventListener("cosmela-cookie-preferences", show);
  }, [convex]);

  function choose(accept: boolean) {
    const choice: Choice = accept ? "accepted" : preference?.choice === "accepted" ? "withdrawn" : "rejected";
    disableAnalytics();
    const next: Preference = { receiptId: crypto.randomUUID(), version: LEGAL_VERSION, choice, timestamp: Date.now(), pending: true };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Choice applies for this session. */ }
    currentPreference.current = next;
    setPreference(next);
    setOpen(false);
    void convex.mutation(recordChoice, { receiptId: next.receiptId, version: next.version, choice }).then(() => {
      if (currentPreference.current?.receiptId !== next.receiptId) return;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...next, pending: false }));
      } catch { /* Storage is optional. */ }
      if (choice === "accepted") enableAnalytics();
    }).catch(() => {});
  }

  if (!open) return null;
  return (
    <div role="region" aria-label="Preferencias de cookies" className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-xl border bg-background p-5 shadow-lg">
      <p className="text-sm">Usamos almacenamiento necesario para tu sesión y preferencias. Si lo autorizas, activamos analítica limitada para mejorar Cosmela. No enviamos fichas de salud, fotografías ni firmas a la analítica.</p>
      <p className="mt-2 text-sm"><Link className="underline" href="/cookies">Política de cookies</Link> · <Link className="underline" href="/privacidad">Privacidad</Link></p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className="min-h-11 rounded-md border px-4 text-sm font-medium" onClick={() => choose(true)}>Aceptar analítica</button>
        <button type="button" className="min-h-11 rounded-md border px-4 text-sm font-medium" onClick={() => choose(false)}>Rechazar analítica</button>
      </div>
    </div>
  );
}

export function CookiePreferencesLink() {
  return <button type="button" className="min-h-11 text-left underline underline-offset-4" onClick={openCookiePreferences}>Preferencias de cookies</button>;
}
