"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { SingleChoice } from "@/components/forms/choice-chips";
import { ColorPicker } from "@/components/forms/color-picker";
import { errorMessage } from "@/components/forms/error-message";
import { useUnsavedChangesGuard } from "@/components/forms/use-unsaved-changes-guard";
import { useUploadFile } from "@/components/shared/photo-upload";
import { SignaturePad, type SignaturePadHandle } from "@/components/shared/signature-pad";
import { useSignedUrl } from "@/components/shared/use-signed-urls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { ScheduleRange } from "@/convex/lib/validators";
import { MEMBER_TITLES } from "@/lib/constants";
import { AppearanceSection } from "./appearance-section";
import { rangesOf, scheduleError, WEEK_DAYS } from "./schedule";
import { ScheduleEditor } from "./schedule-editor";
import { SettingsSection } from "./settings-page";

type Me = FunctionReturnType<typeof api.members.me>;
type SectionName = "profile" | "signature" | "schedule";
type ReportDirty = (section: SectionName, dirty: boolean) => void;

/** Tells the page when a section has edits that are not saved yet. */
function useReportDirty(section: SectionName, dirty: boolean, report: ReportDirty) {
  useEffect(() => report(section, dirty), [section, dirty, report]);
}

export function ProfileSettings() {
  const me = useQuery(api.members.me);
  // Each section saves on its own, so it keeps its edits when another one saves.
  const [dirtySections, setDirtySections] = useState<Record<SectionName, boolean>>({
    profile: false,
    signature: false,
    schedule: false,
  });
  const reportDirty = useCallback<ReportDirty>(
    (section, dirty) => setDirtySections((current) => (current[section] === dirty ? current : { ...current, [section]: dirty })),
    [],
  );
  const leaveDialog = useUnsavedChangesGuard(Object.values(dirtySections).some(Boolean));

  if (!me) {
    return (
      <div aria-busy className="flex flex-col gap-4">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-10">
      <ProfileForm key={me._id} me={me} reportDirty={reportDirty} />
      <SignatureSection signatureKey={me.signatureKey} reportDirty={reportDirty} />
      <ScheduleSection key={JSON.stringify(me.schedule)} schedule={me.schedule} reportDirty={reportDirty} />
      <AppearanceSection />
      {leaveDialog}
    </div>
  );
}

const STANDARD_TITLES: readonly string[] = MEMBER_TITLES.filter((t) => t !== "Otro");

function ProfileForm({ me, reportDirty }: { me: Me; reportDirty: ReportDirty }) {
  const updateProfile = useMutation(api.members.updateProfile);
  const isStandard = !me.title || STANDARD_TITLES.includes(me.title);
  const [name, setName] = useState(me.name);
  const [title, setTitle] = useState<string | null>(isStandard ? (me.title ?? null) : "Otro");
  const [otherTitle, setOtherTitle] = useState(isStandard ? "" : (me.title ?? ""));
  const [color, setColor] = useState(me.color);
  const [saving, setSaving] = useState(false);

  const nextTitle = (title === "Otro" ? otherTitle : title) || undefined;
  const dirty = name !== me.name || nextTitle !== (me.title || undefined) || color !== me.color;
  useReportDirty("profile", dirty, reportDirty);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Escribe tu nombre.");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name, title: nextTitle, color });
      toast.success("Perfil guardado");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSection title="Tus datos">
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-name" className="text-base">
            Nombre
          </Label>
          <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div className="flex flex-col gap-2">
          <span id="profile-title" className="font-medium">
            Título
          </span>
          <SingleChoice
            labelledBy="profile-title"
            options={MEMBER_TITLES.map((t) => ({ value: t, label: t }))}
            value={title}
            onChange={setTitle}
          />
          {title === "Otro" && (
            <Input aria-label="Escribe tu título" value={otherTitle} onChange={(e) => setOtherTitle(e.target.value)} />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <span id="profile-color" className="font-medium">
            Color en la agenda
          </span>
          <ColorPicker value={color} onChange={setColor} labelledBy="profile-color" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-medium">Correo</span>
          <span className="text-ink-soft [overflow-wrap:anywhere]">{me.email}</span>
        </div>
        <Button type="submit" className="self-start" disabled={saving || !dirty}>
          {saving ? "Guardando…" : "Guardar perfil"}
        </Button>
      </form>
    </SettingsSection>
  );
}

function SignatureSection({ signatureKey, reportDirty }: { signatureKey?: string; reportDirty: ReportDirty }) {
  const upload = useUploadFile();
  const attach = useMutation(api.files.attach);
  const url = useSignedUrl(signatureKey);
  const padRef = useRef<SignaturePadHandle>(null);
  const [drawing, setDrawing] = useState(!signatureKey);
  const [empty, setEmpty] = useState(true);
  const [saving, setSaving] = useState(false);
  useReportDirty("signature", drawing && !empty, reportDirty);

  async function save() {
    const blob = await padRef.current?.toBlob();
    if (!blob) {
      toast.error("Dibuja tu firma antes de guardarla.");
      return;
    }
    setSaving(true);
    try {
      const key = await upload(blob, "signature");
      await attach({ key, target: { kind: "memberSignature" } });
      toast.success("Firma guardada");
      setDrawing(false);
    } catch (error) {
      toast.error(errorMessage(error, "No pudimos guardar tu firma. Revisa tu conexión e intenta de nuevo."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSection
      title="Firma profesional"
      description="Se agrega sola a los consentimientos que firmen tus clientes contigo."
    >
      {drawing ? (
        <div className="flex flex-col gap-3">
          <SignaturePad ref={padRef} label="Tu firma" onChange={setEmpty} disabled={saving} />
          <div className="flex gap-2">
            <Button type="button" disabled={saving || empty} onClick={() => void save()}>
              {saving ? "Guardando…" : "Guardar firma"}
            </Button>
            {signatureKey && (
              <Button type="button" variant="secondary" disabled={saving} onClick={() => setDrawing(false)}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex h-40 items-center justify-center rounded-card border border-line bg-surface p-4">
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed R2 URL
              <img src={url} alt="Tu firma guardada" className="signature-ink max-h-full max-w-full object-contain" />
            ) : (
              <Skeleton className="h-16 w-48" />
            )}
          </div>
          <Button type="button" variant="secondary" className="self-start" onClick={() => setDrawing(true)}>
            Cambiar firma
          </Button>
        </div>
      )}
    </SettingsSection>
  );
}

/** The week in a fixed order, so the same hours compare equal. */
const normalized = (schedule: ScheduleRange[]) => JSON.stringify(WEEK_DAYS.flatMap(({ day }) => rangesOf(schedule, day)));

function ScheduleSection({ schedule: initial, reportDirty }: { schedule: ScheduleRange[]; reportDirty: ReportDirty }) {
  const updateSchedule = useMutation(api.members.updateSchedule);
  const [schedule, setSchedule] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = normalized(schedule) !== normalized(initial);
  useReportDirty("schedule", dirty, reportDirty);

  async function save() {
    const message = scheduleError(schedule);
    setError(message);
    if (message) return;
    setSaving(true);
    try {
      await updateSchedule({ schedule });
      toast.success("Horario guardado");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSection title="Mi horario" description="Tus clientes solo pueden reservar contigo en estas horas.">
      <ScheduleEditor value={schedule} onChange={setSchedule} error={error} />
      <Button type="button" className="self-start" disabled={saving || !dirty} onClick={() => void save()}>
        {saving ? "Guardando…" : "Guardar horario"}
      </Button>
    </SettingsSection>
  );
}
