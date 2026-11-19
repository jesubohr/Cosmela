"use client";

import { useAction, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { errorMessage } from "@/components/forms/error-message";
import { useViewer } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { PLANS, readOnlyMessage, SALON_STAFF_LIMIT, type Plan } from "@/convex/lib/billing";
import { inBogota } from "@/convex/lib/time";
import { formatMoney } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";
import { LEGAL_VERSION } from "@/lib/legal-documents";
import { checkoutAuthorizationLabel } from "@/lib/legal-checkout";

type Status = FunctionReturnType<typeof api.billing.status>;
type Prices = FunctionReturnType<typeof api.billing.plans>;

const PLAN_INFO: Record<Plan, { name: string; description: string }> = {
  solo: { name: "Solo", description: "1 profesional. Agenda, fichas, consentimientos y reservas en línea." },
  salon: { name: "Salón", description: `Hasta ${SALON_STAFF_LIMIT} profesionales. Todo lo de Solo para tu equipo.` },
};

const SALES_URL = whatsappLink(
  process.env.NEXT_PUBLIC_SALES_WHATSAPP || undefined,
  `Hola, tengo un salón con más de ${SALON_STAFF_LIMIT} profesionales y quiero usar Cosmela.`,
);

/** "15 de diciembre" (Bogotá). */
function dayAndMonth(ms: number) {
  return format(inBogota(ms), "d 'de' MMMM", { locale: es });
}

function stateLine(status: Status): string {
  const plan = status.plan ? PLAN_INFO[status.plan].name : "";
  switch (status.state) {
    case "beta":
      return "Beta gratuita";
    case "trial": {
      const days = status.trialDaysLeft;
      if (days === undefined) return "Prueba gratis";
      return days === 1 ? "Prueba gratis: te queda 1 día" : `Prueba gratis: te quedan ${days} días`;
    }
    case "active":
      return status.periodEnd ? `Plan ${plan} activo. Próximo cobro: ${dayAndMonth(status.periodEnd)}` : `Plan ${plan} activo`;
    case "canceling":
      return status.periodEnd ? `Tu suscripción termina el ${dayAndMonth(status.periodEnd)}` : "Tu suscripción termina pronto";
    case "past_due":
      return "Pago pendiente: actualiza tu tarjeta";
    case "expired":
      return readOnlyMessage(status);
  }
}

/** Plan (PRODUCT §10): state, plans with Polar prices, checkout, and the Polar portal. */
export function PlanSettings() {
  const { member, org } = useViewer();
  const status = useQuery(api.billing.status);
  const loadPrices = useAction(api.billing.plans);
  const sync = useAction(api.billing.sync);
  const [prices, setPrices] = useState<Prices | undefined>(undefined);
  const isAdmin = member.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    loadPrices({})
      .then(setPrices)
      .catch(() => setPrices(null));
  }, [isAdmin, loadPrices]);

  // Back from a Polar checkout: pull the new subscription (webhooks may lag or, locally, never arrive).
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("checkout")) return;
    window.history.replaceState(null, "", url.pathname);
    void (async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        if (await sync({}).catch(() => false)) {
          toast.success("Suscripción activa");
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      toast("Estamos confirmando tu pago. Actualiza esta página en unos minutos.");
    })();
  }, [sync]);

  if (!status) {
    return (
      <div aria-busy className="flex flex-col gap-4">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const subscribed = status.state === "active" || status.state === "canceling" || status.state === "past_due";
  const recommended: Plan = org.kind === "salon" ? "salon" : "solo";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{stateLine(status)}</h2>
        {status.state === "beta" && (
          <p className="max-w-[60ch] text-ink-soft">
            Todas las funciones están incluidas sin costo mientras dure la beta. Te avisaremos con tiempo antes de
            cualquier cambio.
          </p>
        )}
      </div>

      {isAdmin && (
        <>
          <ul className="divide-y divide-line border-y border-line">
            {PLANS.map((plan) => (
              <PlanRow
                key={plan}
                plan={plan}
                price={prices === undefined ? undefined : (prices?.[plan] ?? null)}
                recommended={!subscribed && plan === recommended}
                current={subscribed && status.plan === plan}
                canChoose={!subscribed && status.state !== "beta"}
              />
            ))}
          </ul>
          <p className="-mt-4 text-sm text-ink-soft">
            ¿Tienes más de {SALON_STAFF_LIMIT} profesionales?{" "}
            <a href={SALES_URL} target="_blank" rel="noreferrer" className="font-medium text-plum underline underline-offset-4">
              Escríbenos
            </a>
          </p>
          {status.hadSubscription && <PortalButton />}
        </>
      )}
    </div>
  );
}

function PlanRow({
  plan,
  price,
  recommended,
  current,
  canChoose,
}: {
  plan: Plan;
  /** Undefined while loading, null when Polar did not answer. */
  price: number | null | undefined;
  recommended: boolean;
  current: boolean;
  canChoose: boolean;
}) {
  const checkout = useAction(api.billing.checkout);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const { name, description } = PLAN_INFO[plan];

  async function choose() {
    setBusy(true);
    try {
      if (!accepted || price === undefined || price === null) return;
      window.location.assign(await checkout({ plan, accepted, version: LEGAL_VERSION, expectedPrice: price }));
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium">{name}</span>
            {(recommended || current) && (
              <span className="rounded-full bg-lilac px-2.5 py-0.5 text-sm font-medium text-plum">
                {current ? "Plan actual" : "Recomendado"}
              </span>
            )}
          </div>
          <p className="text-sm text-ink-soft">{description}</p>
        </div>
        <div className="flex items-center justify-between gap-4 sm:justify-end">
          {price === undefined ? (
            <Skeleton className="h-5 w-28" />
          ) : (
            price !== null && (
              <span className="tabular-nums">
                {formatMoney(price)} <span className="text-ink-soft">/ mes</span>
              </span>
            )
          )}
          {canChoose && (
            <Button variant={recommended ? "default" : "secondary"} disabled={busy || !accepted || price == null} onClick={() => void choose()}>
              {busy ? "Abriendo…" : "Elegir plan"}
            </Button>
          )}
        </div>
      </div>
      {canChoose && price != null && (
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex cursor-pointer items-start gap-3 py-2">
            <Checkbox checked={accepted} onCheckedChange={value => setAccepted(value === true)} aria-label={`Autorizar suscripción ${name}`} />
            <span>{checkoutAuthorizationLabel(plan, price)}</span>
          </label>
          <p className="max-w-[70ch] text-ink-soft">Polar actúa como vendedor y procesa el pago. La prueba no genera un cobro por sí sola. Puedes cancelar futuras renovaciones en Administrar suscripción.</p>
          <div className="flex flex-wrap gap-x-4">
            <Link href="/terminos" target="_blank" className="inline-flex min-h-11 items-center text-plum underline underline-offset-4">Términos</Link>
            <Link href="/reembolsos" target="_blank" className="inline-flex min-h-11 items-center text-plum underline underline-offset-4">Cancelaciones y reembolsos</Link>
            <a href="https://polar.sh/legal/checkout-buyer-terms" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-plum underline underline-offset-4">Condiciones de Polar</a>
          </div>
        </div>
      )}
    </li>
  );
}

function PortalButton() {
  const portal = useAction(api.billing.portal);
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    try {
      window.location.assign(await portal({}));
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" className="self-start" disabled={busy} onClick={() => void open()}>
      {busy ? "Abriendo…" : "Administrar suscripción"}
    </Button>
  );
}
