"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "@/lib/safe-next";
import { ACCOUNT_PRIVACY_LABEL, ACCOUNT_TERMS_LABEL, ADULT_LABEL, LEGAL_VERSION } from "@/lib/legal-documents";
import { OtpInput } from "./otp-input";

const RESEND_SECONDS = 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type AuthError = { code?: string; status?: number } | null | undefined;

function sendErrorMessage(error: AuthError) {
  if (error?.status === 429) return "Pediste varios códigos seguidos. Espera un minuto e intenta de nuevo.";
  return "No pudimos enviar el código. Revisa tu conexión e intenta de nuevo.";
}

function verifyErrorMessage(error: AuthError) {
  switch (error?.code) {
    case "INVALID_OTP":
      return "El código no es correcto. Revísalo e intenta de nuevo.";
    case "OTP_EXPIRED":
      return "El código venció. Pide uno nuevo.";
    case "TOO_MANY_ATTEMPTS":
      return "Hiciste demasiados intentos con este código. Pide uno nuevo.";
  }
  if (error?.status === 429) return "Hiciste varios intentos seguidos. Espera un minuto e intenta de nuevo.";
  return "No pudimos verificar el código. Revisa tu conexión e intenta de nuevo.";
}

function ConsentRow({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (checked: boolean) => void; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-start gap-3 py-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} className="mt-0.5 size-6" />
      <label htmlFor={id} className="cursor-pointer leading-normal">{children}</label>
    </div>
  );
}

function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} target="_blank" className="text-plum underline underline-offset-4">
      {children}
    </Link>
  );
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { isAuthenticated } = useConvexAuth();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [adult, setAdult] = useState(false);
  const legalHeaders = {
    "x-cosmela-legal-version": LEGAL_VERSION,
    "x-cosmela-terms": String(terms),
    "x-cosmela-privacy": String(privacy),
    "x-cosmela-adult": String(adult),
  };

  useEffect(() => {
    if (isAuthenticated) router.replace(next);
  }, [isAuthenticated, next, router]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function sendCode(address: string) {
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email: address, type: "sign-in", fetchOptions: { headers: legalHeaders } });
    if (error) {
      setError(sendErrorMessage(error));
      return false;
    }
    setResendIn(RESEND_SECONDS);
    return true;
  }

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    if (!terms || !privacy || !adult) {
      setError("Confirma las tres opciones para continuar.");
      return;
    }
    const address = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(address)) {
      setError("Escribe un correo válido, como nombre@correo.com.");
      return;
    }
    setPending(true);
    setError(null);
    if (await sendCode(address)) {
      setEmail(address);
      setCode("");
      setStep("code");
    }
    setPending(false);
  }

  async function verify(otp: string) {
    if (otp.length !== 6) {
      setError("Escribe los 6 dígitos del código.");
      return;
    }
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.emailOtp({ email, otp, fetchOptions: { headers: legalHeaders } });
    if (error) {
      setError(verifyErrorMessage(error));
      setCode("");
      setPending(false);
      return;
    }
    router.replace(next);
  }

  async function resend() {
    setPending(true);
    setError(null);
    setCode("");
    if (await sendCode(email)) toast.success("Código reenviado");
    setPending(false);
  }

  if (step === "email") {
    return (
      <form onSubmit={submitEmail} noValidate className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-[1.75rem] leading-tight lg:text-[2.25rem]">Ingresa a Cosmela</h1>
          <p className="text-ink-soft">Te enviaremos un código a tu correo. No necesitas contraseña.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="text-base">
            Correo electrónico
          </Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error" : undefined}
          />
          {error && (
            <p id="login-error" role="alert" className="text-sm text-rose">
              {error}
            </p>
          )}
        </div>
        <div className="flex flex-col">
          <ConsentRow id="login-terms" checked={terms} onChange={setTerms}>
            {ACCOUNT_TERMS_LABEL} <LegalLink href="/terminos">Leer términos</LegalLink>
          </ConsentRow>
          <ConsentRow id="login-privacy" checked={privacy} onChange={setPrivacy}>
            {ACCOUNT_PRIVACY_LABEL} <LegalLink href="/privacidad">Leer política</LegalLink>
          </ConsentRow>
          <ConsentRow id="login-adult" checked={adult} onChange={setAdult}>
            {ADULT_LABEL}
          </ConsentRow>
        </div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Enviando…" : "Enviar código"}
        </Button>
        <p className="text-sm text-ink-soft">
          Cosmela S.A., NIT 99009900-1, utiliza tu correo y los datos de tu cuenta para permitir el acceso, prestar el servicio, proteger la cuenta y atender solicitudes. Puedes ejercer tus derechos en{" "}
          <a className="underline underline-offset-4" href="mailto:ayuda@cosmela.app">ayuda@cosmela.app</a>.
        </p>
      </form>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void verify(code);
      }}
      noValidate
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[1.75rem] leading-tight lg:text-[2.25rem]">Revisa tu correo</h1>
        <p id="otp-hint" className="text-ink-soft">
          Escribe el código de 6 dígitos que enviamos a <span className="font-medium text-ink [overflow-wrap:anywhere]">{email}</span>.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="otp" className="text-base">
          Código
        </Label>
        <OtpInput
          id="otp"
          value={code}
          onChange={(value) => {
            setCode(value);
            if (error) setError(null);
          }}
          onComplete={(value) => void verify(value)}
          invalid={Boolean(error)}
          disabled={pending}
          describedBy={error ? "otp-hint login-error" : "otp-hint"}
        />
        {error && (
          <p id="login-error" role="alert" className="text-sm text-rose">
            {error}
          </p>
        )}
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Verificando…" : "Ingresar"}
      </Button>
      <div className="flex flex-col items-start gap-1">
        {/* Silent while counting down; speaks once when the resend button returns. */}
        <p className="sr-only" aria-live="polite">
          {resendIn === 0 ? "Ya puedes pedir otro código." : ""}
        </p>
        {resendIn > 0 ? (
          <p className="flex min-h-11 items-center text-sm text-ink-soft">Puedes pedir otro código en {resendIn} s</p>
        ) : (
          <Button type="button" variant="link" className="h-11 px-0" disabled={pending} onClick={() => void resend()}>
            Reenviar código
          </Button>
        )}
        <Button
          type="button"
          variant="link"
          className="h-11 px-0 text-ink-soft"
          onClick={() => {
            setStep("email");
            setError(null);
          }}
        >
          Usar otro correo
        </Button>
      </div>
    </form>
  );
}
