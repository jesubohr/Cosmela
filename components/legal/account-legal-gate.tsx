"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { DataRecoveryTools } from "@/components/settings/data-recovery-tools";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/components/shell/use-sign-out";
import { api } from "@/convex/_generated/api";
import { ACCOUNT_PRIVACY_LABEL, ACCOUNT_TERMS_LABEL, ADULT_LABEL, LEGAL_VERSION, PROCESSING_LABEL } from "@/lib/legal-documents";
import { clientRecordGuidePath } from "@/lib/seo";

const PUBLIC_PATHS = ["/ingresar", "/reservar", "/terminos", "/privacidad", "/cookies", "/reembolsos", "/acuerdo-datos", clientRecordGuidePath];


export function AccountLegalGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const isPublic = pathname === "/" || PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const status = useQuery(api.legal.status, isAuthenticated && !isPublic ? {} : "skip");
  const acceptAccount = useMutation(api.legal.acceptAccount);
  const acceptProcessing = useMutation(api.legal.acceptProcessing);
  const signOut = useSignOut();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [adult, setAdult] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  if (isPublic) return children;
  if (isLoading || (isAuthenticated && !status)) return <main className="p-8" aria-live="polite">Cargando…</main>;
  if (!isAuthenticated) return children;
  if (status && status.accountAccepted && status.processingAccepted && !status.closed) return children;

  async function accept() {
    setError("");
    if (!status?.accountAccepted && (!terms || !privacy || !adult)) {
      setError("Confirma las tres opciones para continuar.");
      return;
    }
    if (status?.accountAccepted && !authorized) {
      setError("Confirma tu facultad y acepta el acuerdo para continuar.");
      return;
    }
    setPending(true);
    try {
      if (!status?.accountAccepted) await acceptAccount({ version: LEGAL_VERSION, terms, privacy, adult });
      else await acceptProcessing({ version: LEGAL_VERSION, authorized });
    } catch {
      setError("No pudimos guardar tu decisión. Inténtalo de nuevo.");
    } finally { setPending(false); }
  }


  return <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-5 px-5 py-10">
    <Link href="/" className="self-start font-display text-2xl text-plum">Cosmela</Link>
    {status?.closed ? <>
      <h1 className="font-display text-2xl">Este negocio está cerrado</h1>
      <p>Un administrador puede exportar los datos durante el plazo disponible. Los enlaces a archivos vencen después de cinco minutos.</p>
    </> : !status?.accountAccepted ? <>
      <h1 className="font-display text-2xl">Revisa los documentos de tu cuenta</h1>
      <p>Cosmela S.A. usa tus datos para administrar tu cuenta y prestar el servicio. Puedes ejercer tus derechos en ayuda@cosmela.app.</p>
      <label className="flex items-start gap-2"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /><span>{ACCOUNT_TERMS_LABEL} <Link className="text-plum underline" href="/terminos" target="_blank">Leer términos</Link></span></label>
      <label className="flex items-start gap-2"><input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} /><span>{ACCOUNT_PRIVACY_LABEL} <Link className="text-plum underline" href="/privacidad" target="_blank">Leer política</Link></span></label>
      <label className="flex items-start gap-2"><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} /><span>{ADULT_LABEL}</span></label>
      <Button type="button" disabled={pending} onClick={() => void accept()}>{pending ? "Guardando…" : "Continuar"}</Button>
    </> : status.isAdmin ? <>
      <h1 className="font-display text-2xl">Acuerdo de tratamiento de datos</h1>
      <p>Revisa el acuerdo para continuar con la cuenta del negocio.</p>
      <label className="flex items-start gap-2"><input type="checkbox" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} /><span>{PROCESSING_LABEL} <Link className="text-plum underline" href="/acuerdo-datos" target="_blank">Leer acuerdo</Link></span></label>
      <Button type="button" disabled={pending} onClick={() => void accept()}>{pending ? "Guardando…" : "Aceptar acuerdo"}</Button>
    </> : <><h1 className="font-display text-2xl">El acuerdo del negocio está pendiente</h1><p>Pide a un administrador que revise y acepte el acuerdo de tratamiento de datos.</p></>}
    {status?.isAdmin && <DataRecoveryTools />}
    {error && <p role="alert" className="text-rose">{error}</p>}
    <p>¿Necesitas ayuda? <a href="mailto:ayuda@cosmela.app" className="text-plum underline">ayuda@cosmela.app</a></p>
    <button type="button" className="self-start text-plum underline" onClick={() => void signOut()}>Cerrar sesión</button>
  </main>;
}
