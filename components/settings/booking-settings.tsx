"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Copy, ExternalLink, MessageCircle } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { SingleChoice } from "@/components/forms/choice-chips";
import { DurationInput } from "@/components/forms/duration-input";
import { errorMessage } from "@/components/forms/error-message";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { whatsappLink } from "@/lib/whatsapp";
import { SettingsSection } from "./settings-page";

type Org = FunctionReturnType<typeof api.orgs.get>;
type Member = FunctionReturnType<typeof api.members.list>[number];

const noop = () => () => {};

/** Absolute URL of the public booking page. */
export function useBookingUrl(slug: string) {
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => process.env.NEXT_PUBLIC_SITE_URL ?? "");
  return `${origin}/reservar/${slug}`;
}

export function BookingSettings() {
  const org = useQuery(api.orgs.get);
  const members = useQuery(api.members.list);
  if (!org || !members) {
    return (
      <div aria-busy className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-2/3" />
      </div>
    );
  }
  return <BookingForm key={org._id} org={org} members={members.filter((m) => m.active)} />;
}

function BookingForm({ org, members }: { org: Org; members: Member[] }) {
  const updateBooking = useMutation(api.orgs.updateBooking);
  // Checks "Comparte tu página de reservas" on Hoy.
  const markShared = useMutation(api.dashboard.markChecklist);
  const url = useBookingUrl(org.slug);
  const [enabled, setEnabled] = useState(org.booking.enabled);
  const [minNoticeHours, setMinNoticeHours] = useState<number | null>(org.booking.minNoticeHours);
  const [maxDaysAhead, setMaxDaysAhead] = useState<number | null>(org.booking.maxDaysAhead);
  const [slotMinutes, setSlotMinutes] = useState(org.booking.slotMinutes);
  const [welcome, setWelcome] = useState(org.booking.welcome ?? "");
  const [bookable, setBookable] = useState<Set<Id<"members">>>(
    () => new Set(members.filter((m) => m.bookable).map((m) => m._id)),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado");
      void markShared({ step: "booking" });
    } catch {
      toast.error("No pudimos copiar el enlace. Selecciónalo y cópialo a mano.");
    }
  }

  async function save() {
    const message =
      minNoticeHours === null
        ? "Escribe la anticipación mínima."
        : maxDaysAhead === null || maxDaysAhead < 1
          ? "Escribe cuántos días a futuro se puede reservar."
          : null;
    setError(message);
    if (message) return;
    setSaving(true);
    try {
      await updateBooking({
        enabled,
        minNoticeHours: minNoticeHours!,
        maxDaysAhead: maxDaysAhead!,
        slotMinutes,
        welcome: welcome || undefined,
        bookableMemberIds: [...bookable],
      });
      toast.success("Reservas guardadas");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <SettingsSection title="Página de reservas" description="Tus clientes piden cita en línea y tú la confirmas.">
        <div className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface px-4 py-3">
          <Label htmlFor="booking-enabled" className="text-base">
            Recibir reservas en línea
          </Label>
          <Switch id="booking-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>
        <div className="flex flex-col gap-3">
          <span className="font-medium">Enlace de tu página</span>
          <p className="rounded-lg border border-line bg-surface px-3 py-2.5 text-ink [overflow-wrap:anywhere]">{url}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void copy()}>
              <Copy strokeWidth={1.75} />
              Copiar enlace
            </Button>
            <Button asChild variant="secondary">
              <a
                href={whatsappLink(undefined, `Reserva tu cita en ${org.name}: ${url}`)}
                target="_blank"
                rel="noreferrer"
                onClick={() => void markShared({ step: "booking" })}
              >
                <MessageCircle strokeWidth={1.75} />
                Compartir por WhatsApp
              </a>
            </Button>
            <Button asChild variant="ghost">
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink strokeWidth={1.75} />
                Abrir página
              </a>
            </Button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Reglas">
        <div className="grid max-w-md gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="booking-notice" className="text-base">
              Anticipación mínima
            </Label>
            <DurationInput id="booking-notice" suffix="horas" value={minNoticeHours} onChange={setMinNoticeHours} className="pr-16" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="booking-days" className="text-base">
              Máximo a futuro
            </Label>
            <DurationInput id="booking-days" suffix="días" value={maxDaysAhead} onChange={setMaxDaysAhead} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span id="booking-interval" className="font-medium">
            Intervalo de horarios
          </span>
          <SingleChoice
            labelledBy="booking-interval"
            required
            options={[15, 30, 60].map((minutes) => ({ value: minutes, label: `${minutes} min` }))}
            value={slotMinutes}
            onChange={(value) => value && setSlotMinutes(value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="booking-welcome" className="text-base">
            Mensaje de bienvenida <span className="font-normal text-ink-soft">(opcional)</span>
          </Label>
          <Textarea
            id="booking-welcome"
            value={welcome}
            maxLength={500}
            onChange={(e) => setWelcome(e.target.value)}
            placeholder="Ej.: Hola, elige tu tratamiento y el horario que prefieras."
            className="min-h-20"
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Profesionales que aceptan reservas">
        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          {members.map((member) => {
            const id = `bookable-${member._id}`;
            return (
              <li key={member._id} className="flex min-h-16 items-center gap-3 px-4 py-2">
                <InitialsAvatar name={member.name} color={member.color} />
                <Label htmlFor={id} className="min-w-0 flex-1 text-base">
                  <span className="truncate">{member.isMe ? `${member.name} (tú)` : member.name}</span>
                </Label>
                <Switch
                  id={id}
                  checked={bookable.has(member._id)}
                  onCheckedChange={(checked) =>
                    setBookable((current) => {
                      const next = new Set(current);
                      if (checked) next.add(member._id);
                      else next.delete(member._id);
                      return next;
                    })
                  }
                />
              </li>
            );
          })}
        </ul>
      </SettingsSection>

      {error && (
        <p role="alert" className="text-rose">
          {error}
        </p>
      )}
      <Button type="button" className="self-start" disabled={saving} onClick={() => void save()}>
        {saving ? "Guardando…" : "Guardar cambios"}
      </Button>
    </div>
  );
}
