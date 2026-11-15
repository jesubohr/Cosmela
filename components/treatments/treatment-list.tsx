"use client";

import { useMutation, useQuery } from "convex/react";
import { ChevronRight, Globe, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { errorMessage } from "@/components/forms/error-message";
import { EmptyState } from "@/components/shared/empty-state";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { useViewer } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { TREATMENT_CATEGORIES } from "@/convex/lib/validators";
import { STAFF_COLORS, TREATMENT_CATEGORY_LABELS } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type Treatment = FunctionReturnType<typeof api.treatments.list>[number];

export function TreatmentList() {
  const isAdmin = useViewer().member.role === "admin";
  const treatments = useQuery(api.treatments.list);

  const newButton = isAdmin && (
    <Button asChild>
      <Link href="/tratamientos/nuevo">
        <Plus />
        Nuevo tratamiento
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader title="Tratamientos" actions={newButton} />
      <PageBody className="flex flex-col gap-8">
        {treatments === undefined ? (
          <div aria-busy className="flex flex-col gap-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : treatments.length === 0 ? (
          <EmptyState
            message={
              isAdmin
                ? "Aún no tienes tratamientos. Agrégalos desde las plantillas o crea uno desde cero."
                : "Aún no hay tratamientos. Pide a un administrador que los agregue."
            }
            action={newButton}
          />
        ) : (
          TREATMENT_CATEGORIES.map((category) => {
            const items = treatments.filter((t) => t.category === category);
            if (items.length === 0) return null;
            return (
              <section key={category} className="flex flex-col gap-3">
                <h2 className="text-lg font-medium">{TREATMENT_CATEGORY_LABELS[category]}</h2>
                <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
                  {items.map((treatment) => (
                    <TreatmentRow key={treatment._id} treatment={treatment} isAdmin={isAdmin} />
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </PageBody>
    </>
  );
}

function TreatmentRow({ treatment, isAdmin }: { treatment: Treatment; isAdmin: boolean }) {
  const setActive = useMutation(api.treatments.setActive);

  async function toggle(active: boolean) {
    try {
      await setActive({ id: treatment._id, active });
      toast.success(active ? "Tratamiento activado" : "Tratamiento desactivado");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <li className="flex items-center">
      <Link
        href={`/tratamientos/${treatment._id}`}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2 pl-4 hover:bg-porcelain/60"
      >
        <span
          aria-hidden
          className="size-3 shrink-0 rounded-full"
          style={{ backgroundColor: STAFF_COLORS[treatment.color].strong }}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn("truncate font-medium", !treatment.active && "text-ink-soft")}>{treatment.name}</span>
          <span className="flex flex-wrap items-center gap-x-4 text-sm text-ink-soft tabular-nums">
            <span>{treatment.durationMin} min</span>
            <span>{formatMoney(treatment.price)}</span>
            {treatment.bookableOnline && (
              <span className="inline-flex items-center" title="Disponible para reserva en línea">
                <Globe aria-hidden className="size-4" strokeWidth={1.75} />
                <span className="sr-only">Disponible para reserva en línea</span>
              </span>
            )}
            {!treatment.active && <span>Inactivo</span>}
          </span>
        </span>
        {!isAdmin && <ChevronRight aria-hidden className="mr-4 size-5 shrink-0 text-ink-soft" strokeWidth={1.75} />}
      </Link>
      {isAdmin && (
        <div className="flex min-h-16 items-center px-4">
          <Switch
            checked={treatment.active}
            onCheckedChange={(active) => void toggle(active)}
            aria-label={`${treatment.name} activo`}
          />
        </div>
      )}
    </li>
  );
}
