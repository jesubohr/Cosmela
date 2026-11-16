"use client";

import { useMutation, usePreloadedQuery, useQuery, type Preloaded } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { ChevronRight, Users } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { errorMessage } from "@/components/forms/error-message";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { useTimeBucket } from "@/components/shared/use-signed-urls";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDate, formatDuration, formatMoney, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";
import { DaySlots } from "./day-slots";
import { DetailsForm, type Details } from "./details-form";
import { BookingMessage, BookingShell, BusinessHeader, RowList, Step } from "./parts";

type PageData = NonNullable<FunctionReturnType<typeof api.booking.page>>;
type Sent = { treatmentName: string; start: number; memberName?: string; email: string };

export function BookingFlow({ slug, preloaded }: { slug: string; preloaded: Preloaded<typeof api.booking.page> }) {
  const page = usePreloadedQuery(preloaded);
  const bucket = useTimeBucket();
  const logoUrl = useQuery(api.booking.logo, page?.hasLogo ? { slug, bucket } : "skip");

  if (!page) {
    return (
      <BookingShell>
        <BookingMessage
          title="No encontramos esta página de reservas"
          text="Revisa el enlace o pídele uno nuevo al negocio."
        />
      </BookingShell>
    );
  }

  return (
    <BookingShell>
      <BusinessHeader name={page.name} city={page.city} logoUrl={logoUrl} whatsapp={page.whatsapp}>
        {page.welcome && <p className="max-w-[52ch] whitespace-pre-line">{page.welcome}</p>}
      </BusinessHeader>
      {page.enabled ? (
        <Flow slug={slug} page={page} />
      ) : (
        <BookingMessage
          title={`${page.name} no está recibiendo reservas en línea`}
          text="Escríbele directamente para agendar tu cita."
        >
          <WhatsAppButton phone={page.whatsapp} orgName={page.name} />
        </BookingMessage>
      )}
    </BookingShell>
  );
}

function WhatsAppButton({ phone, orgName }: { phone?: string; orgName: string }) {
  if (!phone) return null;
  return (
    <Button asChild variant="secondary">
      <a href={whatsappLink(phone, `Hola, ${orgName}. Quiero agendar una cita.`)} target="_blank" rel="noreferrer">
        Escribir por WhatsApp
      </a>
    </Button>
  );
}

function Flow({ slug, page }: { slug: string; page: PageData }) {
  const [treatmentId, setTreatmentId] = useState<Id<"treatments"> | null>(null);
  const [member, setMember] = useState<Id<"members"> | "any" | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [start, setStart] = useState<number | null>(null);
  // Availability comes in windows of up to 14 days; `earlier` holds the starts of the windows seen before.
  const [windowFrom, setWindowFrom] = useState<string | undefined>();
  const [earlier, setEarlier] = useState<(string | undefined)[]>([]);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const create = useMutation(api.booking.create);

  const needsMember = page.members.length > 1;
  const treatment = page.treatments.find((t) => t._id === treatmentId);
  const memberId = member && member !== "any" ? member : undefined;
  const chosenMember = page.members.find((m) => m._id === memberId);
  const step = !treatment ? "treatment" : needsMember && !member ? "member" : start === null ? "time" : "details";

  const availability = useQuery(
    api.booking.availability,
    treatment && step !== "member" ? { slug, treatmentId: treatment._id, memberId, from: windowFrom } : "skip",
  );
  const days = availability?.days;
  const nextFrom = availability?.nextFrom ?? null;

  // Bring the next step into view after each choice (not on first load).
  const stepRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    stepRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, [step]);

  function choose(update: () => void) {
    moved.current = true;
    update();
  }

  function resetTime() {
    setDate(null);
    setStart(null);
    setSlotError(null);
    setWindowFrom(undefined);
    setEarlier([]);
  }

  function showWindow(from: string | undefined, back: boolean) {
    setEarlier((stack) => (back ? stack.slice(0, -1) : [...stack, windowFrom]));
    setWindowFrom(from);
    setDate(null);
  }

  async function submit(details: Details) {
    if (!treatment || start === null) return null;
    try {
      const result = await create({
        slug,
        treatmentId: treatment._id,
        memberId,
        start,
        firstName: details.firstName,
        lastName: details.lastName,
        phone: details.phone,
        email: details.email,
        note: details.note || undefined,
        authorized: details.authorized,
        website: details.website || undefined,
      });
      setSent({
        treatmentName: treatment.name,
        start,
        memberName: needsMember ? result.memberName : undefined,
        email: details.email.trim().toLowerCase(),
      });
      window.scrollTo({ top: 0 });
      return null;
    } catch (error) {
      if (error instanceof ConvexError && (error.data as { code?: string }).code === "SLOT_TAKEN") {
        choose(() => {
          setStart(null);
          setSlotError(errorMessage(error));
        });
        return null;
      }
      return errorMessage(error, "No pudimos enviar tu solicitud. Revisa tu conexión e intenta de nuevo.");
    }
  }

  if (sent) return <Confirmation orgName={page.name} sent={sent} />;

  return (
    <div className="flex flex-col gap-8">
      {treatment && (
        <RowList label="Tu reserva">
          <SummaryRow
            label="Cambiar tratamiento"
            primary={treatment.name}
            secondary={`${formatDuration(treatment.durationMin)}, ${formatMoney(treatment.price)}`}
            onChange={() => choose(() => {
              setTreatmentId(null);
              resetTime();
            })}
          />
          {needsMember && member && (
            <SummaryRow
              label="Cambiar profesional"
              primary={chosenMember ? `Con ${chosenMember.name}` : "Cualquiera disponible"}
              onChange={() => choose(() => {
                setMember(null);
                resetTime();
              })}
            />
          )}
          {start !== null && (
            <SummaryRow
              label="Cambiar día y hora"
              primary={<span className="font-display text-[1.375rem] leading-tight tabular-nums">{formatTime(start)}</span>}
              secondary={formatDate(start)}
              onChange={() => choose(() => setStart(null))}
            />
          )}
        </RowList>
      )}

      <div ref={stepRef} className="scroll-mt-6">
        {step === "treatment" && (
          <Step title="Elige el tratamiento">
            {page.treatments.length === 0 ? (
              <BookingMessage
                title="Aún no hay tratamientos para reservar en línea"
                text={`Escribe a ${page.name} para agendar tu cita.`}
              >
                <WhatsAppButton phone={page.whatsapp} orgName={page.name} />
              </BookingMessage>
            ) : (
              <RowList label="Tratamientos">
                {page.treatments.map((t) => (
                  <li key={t._id}>
                    <RowButton onClick={() => choose(() => setTreatmentId(t._id))}>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{t.name}</span>
                        {t.description && (
                          <span className="mt-1 line-clamp-2 block text-sm text-ink-soft">{t.description}</span>
                        )}
                      </span>
                      <span className="shrink-0 text-right tabular-nums">
                        <span className="block font-medium">{formatMoney(t.price)}</span>
                        <span className="mt-1 block text-sm text-ink-soft">{formatDuration(t.durationMin)}</span>
                      </span>
                    </RowButton>
                  </li>
                ))}
              </RowList>
            )}
          </Step>
        )}

        {step === "member" && (
          <Step title="¿Con quién quieres tu cita?">
            <RowList label="Profesionales">
              <li>
                <RowButton onClick={() => choose(() => setMember("any"))} className="items-center">
                  <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-lilac text-plum">
                    <Users className="size-5" strokeWidth={1.75} />
                  </span>
                  <span className="flex-1 font-medium">Cualquiera disponible</span>
                  <ChevronRight aria-hidden className="size-5 text-ink-soft" strokeWidth={1.75} />
                </RowButton>
              </li>
              {page.members.map((m) => (
                <li key={m._id}>
                  <RowButton onClick={() => choose(() => setMember(m._id))} className="items-center">
                    <InitialsAvatar name={m.name} color={m.color} />
                    <span className="flex-1 font-medium">{m.name}</span>
                    <ChevronRight aria-hidden className="size-5 text-ink-soft" strokeWidth={1.75} />
                  </RowButton>
                </li>
              ))}
            </RowList>
          </Step>
        )}

        {step === "time" && (
          <Step title="Elige el día y la hora">
            {slotError && (
              <p role="alert" className="rounded-lg bg-amber-soft px-4 py-3 text-amber">
                {slotError}
              </p>
            )}
            {days === undefined ? (
              <TimeSkeleton />
            ) : days.length === 0 && !nextFrom && earlier.length === 0 ? (
              <BookingMessage
                title="No hay horarios libres en los próximos días"
                text={memberId ? `Elige otra persona del equipo o escribe a ${page.name}.` : `Escribe a ${page.name} para buscar un espacio.`}
              >
                <WhatsAppButton phone={page.whatsapp} orgName={page.name} />
              </BookingMessage>
            ) : (
              <>
                {days.length === 0 ? (
                  <p className="text-ink-soft">No hay horarios libres en estos días.</p>
                ) : (
                  <DaySlots
                    days={days}
                    date={date}
                    onDateChange={setDate}
                    onPick={(slot) => choose(() => {
                      setStart(slot);
                      setSlotError(null);
                    })}
                  />
                )}
                {(earlier.length > 0 || nextFrom) && (
                  <div className="flex flex-wrap gap-2">
                    {earlier.length > 0 && (
                      <Button type="button" variant="ghost" onClick={() => showWindow(earlier[earlier.length - 1], true)}>
                        Días anteriores
                      </Button>
                    )}
                    {nextFrom && (
                      <Button type="button" variant="secondary" onClick={() => showWindow(nextFrom, false)}>
                        Ver más días
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </Step>
        )}

        {step === "details" && (
          <Step title="Tus datos">
            <DetailsForm orgName={page.name} slug={slug} onSubmit={submit} />
          </Step>
        )}
      </div>
    </div>
  );
}

function RowButton({ onClick, className, children }: { onClick: () => void; className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-16 w-full items-start gap-4 px-4 py-4 text-left transition-colors hover:bg-porcelain focus-visible:-outline-offset-2 active:bg-lilac",
        className,
      )}
    >
      {children}
    </button>
  );
}

function SummaryRow({
  label,
  primary,
  secondary,
  onChange,
}: {
  label: string;
  primary: ReactNode;
  secondary?: string;
  onChange: () => void;
}) {
  return (
    <li className="flex min-h-16 items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{primary}</p>
        {secondary && <p className="text-sm text-ink-soft">{secondary}</p>}
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onChange} aria-label={label} className="text-plum">
        Cambiar
      </Button>
    </li>
  );
}

function TimeSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-5">
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[76px] w-16 shrink-0 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-[52px] rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function Confirmation({ orgName, sent }: { orgName: string; sent: Sent }) {
  return (
    <section aria-live="polite" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-[1.75rem] leading-tight">Solicitud enviada</h2>
        <p className="text-ink-soft">
          {orgName} confirmará tu cita por correo a <span className="text-ink [overflow-wrap:anywhere]">{sent.email}</span>.
        </p>
      </div>
      <div className="rounded-card border border-line bg-surface p-5">
        <p className="font-display text-[2.25rem] leading-none tabular-nums">{formatTime(sent.start)}</p>
        <p className="mt-2">{formatDate(sent.start)}</p>
        <p className="mt-4 border-t border-line pt-4 font-medium">{sent.treatmentName}</p>
        {sent.memberName && <p className="text-ink-soft">Con {sent.memberName}</p>}
      </div>
    </section>
  );
}
