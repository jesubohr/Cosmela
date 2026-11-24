"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { SingleChoice } from "@/components/forms/choice-chips";
import { errorMessage } from "@/components/forms/error-message";
import { ColorPicker } from "@/components/forms/color-picker";
import { DEFAULT_SCHEDULE, scheduleError } from "@/components/settings/schedule";
import { ScheduleEditor } from "@/components/settings/schedule-editor";
import { PhoneInput } from "@/components/shared/phone-input";
import { useSignOut } from "@/components/shell/use-sign-out";
import { picksError, picksFor, picksToArgs, TemplateList, type TemplatePicks } from "@/components/treatments/template-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { OrgKind, ScheduleRange, StaffColor } from "@/convex/lib/validators";
import { TREATMENT_TEMPLATES } from "@/data/treatment-templates";
import { MEMBER_TITLES, ORG_KIND_LABELS } from "@/lib/constants";
import { isValidPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CreatingSplash } from "./creating-splash";

/** DOM ids of the fields that can show an error. */
type FieldId = "kind-solo" | "business-name" | "legal-name" | "tax-id" | "address" | "city" | "whatsapp" | "name";

const STEPS = [
  { key: "kind", title: "¿Cómo trabajas?" },
  { key: "legal", title: "Datos legales del negocio" },
  { key: "profile", title: "Tu perfil" },
  { key: "treatments", title: "Tus tratamientos" },
  { key: "schedule", title: "Tu horario" },
] as const;

export function OnboardingFlow() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.auth.viewer, isAuthenticated ? {} : "skip");
  // Creating the business adds `viewer.member` before the redirect ends; keep the wizard (and its splash) mounted.
  const [wizardShown, setWizardShown] = useState(false);
  if (!wizardShown && viewer && !viewer.member) setWizardShown(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/ingresar?next=/bienvenida");
    else if (viewer === null) router.replace("/ingresar?next=/bienvenida");
    else if (viewer?.member) router.replace("/hoy");
  }, [isLoading, isAuthenticated, viewer, router]);

  if (!wizardShown || !isAuthenticated) {
    return (
      <Frame step={0}>
        <div aria-busy className="flex flex-col gap-4">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Frame>
    );
  }

  const userName = viewer?.user.name ?? "";
  return <Wizard initialName={userName.includes("@") ? "" : userName} />;
}

function Wizard({ initialName }: { initialName: string }) {
  const router = useRouter();
  const signOut = useSignOut();
  const createOrg = useMutation(api.orgs.create);
  const invitations = useQuery(api.invitations.mine);

  const [step, setStep] = useState(0);
  const current = STEPS[step].key;
  // Step errors show after the first "Continuar" and clear as soon as the step is fixed.
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [kind, setKind] = useState<OrgKind | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [name, setName] = useState(initialName);
  const [title, setTitle] = useState<string | null>(null);
  const [otherTitle, setOtherTitle] = useState("");
  const [color, setColor] = useState<StaffColor>("plum");
  const [picks, setPicks] = useState<TemplatePicks>(() => picksFor(TREATMENT_TEMPLATES.filter((t) => t.popular)));
  const [schedule, setSchedule] = useState<ScheduleRange[]>(DEFAULT_SCHEDULE);

  // Prefetch so the redirect after "Crear negocio" does not wait for the page code.
  useEffect(() => {
    router.prefetch("/hoy");
  }, [router]);

  /** Errors of the text fields of the current step, in page order. They derive from the values, so they clear once the field is valid. */
  function fieldErrors(): Partial<Record<FieldId, string>> {
    const errors: Partial<Record<FieldId, string>> = {};
    if (current === "kind") {
      if (!kind) errors["kind-solo"] = "Elige cómo trabajas.";
      else if (!businessName.trim()) errors["business-name"] = "Escribe el nombre de tu negocio.";
    } else if (current === "legal") {
      if (!legalName.trim()) errors["legal-name"] = "Escribe la razón social o tu nombre completo.";
      if (!taxId.trim()) errors["tax-id"] = "Escribe el NIT o tu número de cédula.";
      if (!address.trim()) errors.address = "Escribe la dirección del negocio.";
      if (!city.trim()) errors.city = "Escribe la ciudad.";
      if (!isValidPhone(whatsapp)) errors.whatsapp = "Escribe un WhatsApp de 10 dígitos.";
    } else if (current === "profile" && !name.trim()) {
      errors.name = "Escribe tu nombre.";
    }
    return errors;
  }

  function stepError(): string | null {
    if (current === "treatments") return picksError(picks);
    if (current === "schedule") return scheduleError(schedule);
    return Object.values(fieldErrors())[0] ?? null;
  }

  async function next() {
    setServerError(null);
    if (stepError()) {
      setAttempted(true);
      const [firstInvalid] = Object.keys(fieldErrors());
      if (firstInvalid) document.getElementById(firstInvalid)?.focus();
      return;
    }
    if (step < STEPS.length - 1) {
      setAttempted(false);
      setStep(step + 1);
      window.scrollTo({ top: 0 });
      return;
    }
    setSaving(true);
    try {
      await createOrg({
        kind: kind!,
        name: businessName,
        legalName,
        taxId,
        address,
        city,
        whatsapp,
        profile: { name, title: (title === "Otro" ? otherTitle : title) || undefined, color },
        schedule,
        treatments: picksToArgs(picks),
      });
      router.replace("/hoy");
    } catch (err) {
      setServerError(errorMessage(err, "No pudimos crear tu negocio. Revisa tu conexión e intenta de nuevo."));
      setSaving(false);
    }
  }

  function back() {
    setAttempted(false);
    setServerError(null);
    setStep(step - 1);
    window.scrollTo({ top: 0 });
  }

  const pickCount = Object.keys(picks).length;
  const errors = attempted ? fieldErrors() : {};
  const listStep = current === "treatments" || current === "schedule";
  const bottomError = (attempted && listStep ? stepError() : null) ?? serverError;

  return (
    <Frame
      step={step}
      footer={
        <>
          {step > 0 && (
            <Button type="button" variant="ghost" size="lg" onClick={back} disabled={saving}>
              Atrás
            </Button>
          )}
          <Button type="submit" form="onboarding" size="lg" className="ml-auto min-w-36" disabled={saving}>
            {step === STEPS.length - 1 ? (saving ? "Creando…" : "Crear negocio") : "Continuar"}
          </Button>
        </>
      }
    >
      {saving && <CreatingSplash />}
      <form
        id="onboarding"
        noValidate
        inert={saving}
        onSubmit={(event) => {
          event.preventDefault();
          void next();
        }}
        className="flex flex-col gap-8"
      >
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-[1.75rem] leading-tight lg:text-[2.25rem]">{STEPS[step].title}</h1>
          {current === "legal" && (
            <p className="max-w-[70ch] text-ink-soft">
              La ley de protección de datos exige que tus clientes sepan quién guarda su información y cómo contactarte. Sin
              estos datos no puedes registrar clientes. Aparecen en tu política de datos y en las fichas impresas.
            </p>
          )}
          {current === "treatments" && (
            <p className="text-ink-soft">
              Elige los que ofreces y ajusta el precio y la duración. Puedes cambiar esto después.
            </p>
          )}
          {current === "schedule" && <p className="text-ink-soft">Tus clientes solo podrán reservar en estas horas.</p>}
        </div>

        {current === "kind" && (
          <>
            {invitations?.map((invitation) => (
              <div key={invitation.token} className="flex flex-col gap-3 rounded-card border border-transparent bg-surface p-4 shadow-border">
                <p>{invitation.orgName} te invitó a su equipo.</p>
                <Button asChild variant="secondary" className="self-start">
                  <Link href={`/invitacion/${invitation.token}`}>Ver invitación</Link>
                </Button>
              </div>
            ))}
            <div className="flex flex-col gap-2">
              <div
                role="radiogroup"
                aria-label="¿Cómo trabajas?"
                aria-describedby={errors["kind-solo"] ? "kind-error" : undefined}
                className="grid gap-3 sm:grid-cols-2"
              >
                <KindOption id="kind-solo" selected={kind === "solo"} onSelect={() => setKind("solo")}>
                  {ORG_KIND_LABELS.solo}
                </KindOption>
                <KindOption selected={kind === "salon"} onSelect={() => setKind("salon")}>
                  {ORG_KIND_LABELS.salon}
                </KindOption>
              </div>
              <FieldError id="kind-error">{errors["kind-solo"]}</FieldError>
            </div>
            {kind && (
              <TextField
                id="business-name"
                label="¿Cómo se llama tu negocio?"
                hint={kind === "solo" ? "Puede ser tu nombre." : undefined}
                value={businessName}
                onChange={setBusinessName}
                autoComplete="organization"
                error={errors["business-name"]}
              />
            )}
          </>
        )}

        {current === "legal" && (
          <div className="flex flex-col gap-5">
            <TextField
              id="legal-name"
              label="Razón social o nombre legal"
              hint="Si trabajas como persona natural, escribe tu nombre completo."
              value={legalName}
              onChange={setLegalName}
              error={errors["legal-name"]}
            />
            <TextField
              id="tax-id"
              label="NIT o cédula"
              hint="Si no tienes NIT, usa tu número de cédula."
              value={taxId}
              onChange={setTaxId}
              error={errors["tax-id"]}
            />
            <TextField
              id="address"
              label="Dirección"
              value={address}
              onChange={setAddress}
              autoComplete="street-address"
              error={errors.address}
            />
            <TextField id="city" label="Ciudad" value={city} onChange={setCity} autoComplete="address-level2" error={errors.city} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="whatsapp" className="text-base">
                WhatsApp del negocio
              </Label>
              <PhoneInput
                id="whatsapp"
                value={whatsapp}
                onChange={setWhatsapp}
                aria-invalid={errors.whatsapp ? true : undefined}
                aria-describedby={errors.whatsapp ? "whatsapp-error" : undefined}
              />
              <FieldError id="whatsapp-error">{errors.whatsapp}</FieldError>
            </div>
          </div>
        )}

        {current === "profile" && (
          <div className="flex flex-col gap-6">
            <TextField id="name" label="Tu nombre" value={name} onChange={setName} autoComplete="name" error={errors.name} />
            <div className="flex flex-col gap-2">
              <span id="title-label" className="font-medium">
                ¿Cuál es tu título?
              </span>
              <SingleChoice
                labelledBy="title-label"
                options={MEMBER_TITLES.map((t) => ({ value: t, label: t }))}
                value={title}
                onChange={setTitle}
              />
              {title === "Otro" && (
                <Input aria-label="Escribe tu título" value={otherTitle} onChange={(e) => setOtherTitle(e.target.value)} />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <span id="color-label" className="font-medium">
                Tu color en la agenda
              </span>
              <ColorPicker value={color} onChange={setColor} labelledBy="color-label" />
            </div>
          </div>
        )}

        {current === "treatments" && (
          <div className="flex flex-col gap-4">
            <p aria-live="polite" className="text-sm text-ink-soft">
              {pickCount === 1 ? "1 tratamiento elegido" : `${pickCount} tratamientos elegidos`}
            </p>
            <TemplateList picks={picks} onChange={setPicks} />
          </div>
        )}

        {current === "schedule" && <ScheduleEditor value={schedule} onChange={setSchedule} />}

        {bottomError && (
          <p role="alert" className="text-rose">
            {bottomError}
          </p>
        )}

        {current === "kind" && (
          <Button type="button" variant="link" className="h-11 self-start px-0 text-ink-soft" onClick={() => void signOut()}>
            Cerrar sesión
          </Button>
        )}
      </form>
    </Frame>
  );
}

function Frame({ step, footer, children }: { step: number; footer?: ReactNode; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col pt-safe">
      <header className="mx-auto flex w-full max-w-[720px] items-center justify-between gap-4 px-4 pt-6 lg:px-8">
        <span className="font-display text-[1.375rem] leading-none text-plum">Cosmela</span>
        <ProgressDots step={step} />
      </header>
      <div className="mx-auto w-full max-w-[720px] flex-1 px-4 pt-10 pb-32 lg:px-8">{children}</div>
      {footer && (
        <footer className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 pb-safe backdrop-blur">
          <div className="mx-auto flex w-full max-w-[720px] items-center gap-3 px-4 py-3 lg:px-8">{footer}</div>
        </footer>
      )}
    </main>
  );
}

function ProgressDots({ step }: { step: number }) {
  return (
    <ol aria-label={`Paso ${step + 1} de ${STEPS.length}`} className="flex items-center gap-2">
      {STEPS.map(({ key, title }, index) => (
        <li
          key={key}
          aria-current={index === step ? "step" : undefined}
          className={cn(
            "h-2 rounded-full transition-[width,background-color]",
            index === step ? "w-6 bg-plum" : "w-2",
            index < step && "bg-plum/60",
            index > step && "bg-line",
          )}
        >
          <span className="sr-only">{title}</span>
        </li>
      ))}
    </ol>
  );
}

function KindOption({
  id,
  selected,
  onSelect,
  children,
}: {
  id?: string;
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      id={id}
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex min-h-20 items-center justify-between gap-4 rounded-card border-2 p-4 text-left text-lg font-medium transition-colors",
        selected ? "border-plum bg-lilac text-plum" : "border-line bg-surface hover:bg-lilac/60",
      )}
    >
      {children}
      {selected && <Check aria-hidden className="size-6 shrink-0" strokeWidth={2.5} />}
    </button>
  );
}

function TextField({
  id,
  label,
  hint,
  value,
  onChange,
  autoComplete,
  error,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-base">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-ink-soft">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-sm text-rose">
      {children}
    </p>
  );
}

