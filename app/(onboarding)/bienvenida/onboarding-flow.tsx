"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Store, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
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

const STEPS = ["¿Cómo trabajas?", "Tu perfil", "Tus tratamientos", "Tu horario"];

export function OnboardingFlow() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.auth.viewer, isAuthenticated ? {} : "skip");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/ingresar?next=/bienvenida");
    else if (viewer === null) router.replace("/ingresar?next=/bienvenida");
    else if (viewer?.member) router.replace("/hoy");
  }, [isLoading, isAuthenticated, viewer, router]);

  if (!viewer || viewer.member) {
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

  const name = viewer.user.name?.includes("@") ? "" : (viewer.user.name ?? "");
  return <Wizard initialName={name} />;
}

function Wizard({ initialName }: { initialName: string }) {
  const router = useRouter();
  const signOut = useSignOut();
  const createOrg = useMutation(api.orgs.create);
  const invitations = useQuery(api.invitations.mine);

  const [step, setStep] = useState(0);
  // Step errors show after the first "Continuar" and clear as soon as the step is fixed.
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [kind, setKind] = useState<OrgKind | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [city, setCity] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [name, setName] = useState(initialName);
  const [title, setTitle] = useState<string | null>(null);
  const [otherTitle, setOtherTitle] = useState("");
  const [color, setColor] = useState<StaffColor>("plum");
  const [picks, setPicks] = useState<TemplatePicks>(() => picksFor(TREATMENT_TEMPLATES.filter((t) => t.popular)));
  const [schedule, setSchedule] = useState<ScheduleRange[]>(DEFAULT_SCHEDULE);

  function stepError(): string | null {
    switch (step) {
      case 0:
        if (!kind) return "Elige cómo trabajas.";
        if (!businessName.trim()) return "Escribe el nombre de tu negocio.";
        if (whatsapp && !isValidPhone(whatsapp)) return "Escribe un WhatsApp de 10 dígitos.";
        return null;
      case 1:
        return name.trim() ? null : "Escribe tu nombre.";
      case 2:
        return picksError(picks);
      default:
        return scheduleError(schedule);
    }
  }

  async function next() {
    setServerError(null);
    if (stepError()) {
      setAttempted(true);
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
        city: city.trim() || undefined,
        whatsapp: whatsapp || undefined,
        profile: { name, title: (title === "Otro" ? otherTitle : title) || undefined, color },
        schedule,
        treatments: picksToArgs(picks),
      });
      toast.success("Negocio creado");
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
  const error = (attempted ? stepError() : null) ?? serverError;

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
      <form
        id="onboarding"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void next();
        }}
        className="flex flex-col gap-8"
      >
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-[1.75rem] leading-tight lg:text-[2.25rem]">{STEPS[step]}</h1>
          {step === 2 && (
            <p className="text-ink-soft">
              Elige los que ofreces y ajusta el precio y la duración. Puedes cambiar esto después.
            </p>
          )}
          {step === 3 && <p className="text-ink-soft">Tus clientes solo podrán reservar en estas horas.</p>}
        </div>

        {step === 0 && (
          <>
            {invitations?.map((invitation) => (
              <div key={invitation.token} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
                <p>{invitation.orgName} te invitó a su equipo.</p>
                <Button asChild variant="secondary" className="self-start">
                  <Link href={`/invitacion/${invitation.token}`}>Ver invitación</Link>
                </Button>
              </div>
            ))}
            <div role="radiogroup" aria-label="¿Cómo trabajas?" className="grid gap-3 sm:grid-cols-2">
              <KindOption icon={UserRound} selected={kind === "solo"} onSelect={() => setKind("solo")}>
                {ORG_KIND_LABELS.solo}
              </KindOption>
              <KindOption icon={Store} selected={kind === "salon"} onSelect={() => setKind("salon")}>
                {ORG_KIND_LABELS.salon}
              </KindOption>
            </div>
            {kind && (
              <div className="flex flex-col gap-5">
                <TextField
                  id="business-name"
                  label="¿Cómo se llama tu negocio?"
                  hint={kind === "solo" ? "Puede ser tu nombre." : undefined}
                  value={businessName}
                  onChange={setBusinessName}
                  autoComplete="organization"
                />
                <TextField id="city" label="Ciudad" value={city} onChange={setCity} autoComplete="address-level2" />
                <div className="flex flex-col gap-2">
                  <Label htmlFor="whatsapp" className="text-base">
                    WhatsApp del negocio
                  </Label>
                  <PhoneInput id="whatsapp" value={whatsapp} onChange={setWhatsapp} />
                </div>
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-6">
            <TextField id="name" label="Tu nombre" value={name} onChange={setName} autoComplete="name" />
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

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <p aria-live="polite" className="text-sm text-ink-soft">
              {pickCount === 1 ? "1 tratamiento elegido" : `${pickCount} tratamientos elegidos`}
            </p>
            <TemplateList picks={picks} onChange={setPicks} />
          </div>
        )}

        {step === 3 && <ScheduleEditor value={schedule} onChange={setSchedule} />}

        {error && (
          <p role="alert" className="text-rose">
            {error}
          </p>
        )}

        {step === 0 && (
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
      {STEPS.map((label, index) => (
        <li
          key={label}
          aria-current={index === step ? "step" : undefined}
          className={cn(
            "h-2 rounded-full transition-all",
            index === step ? "w-6 bg-plum" : "w-2",
            index < step && "bg-plum/60",
            index > step && "bg-line",
          )}
        >
          <span className="sr-only">{label}</span>
        </li>
      ))}
    </ol>
  );
}

function KindOption({
  icon: Icon,
  selected,
  onSelect,
  children,
}: {
  icon: typeof Store;
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex min-h-24 items-center gap-4 rounded-card border-2 bg-surface p-4 text-left text-lg font-medium transition-colors",
        selected ? "border-plum bg-lilac text-plum" : "border-line hover:border-plum/30",
      )}
    >
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-full",
          selected ? "bg-surface" : "bg-porcelain",
        )}
      >
        <Icon className="size-6 text-plum" strokeWidth={1.75} />
      </span>
      {children}
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
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
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
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-ink-soft">
          {hint}
        </p>
      )}
    </div>
  );
}

