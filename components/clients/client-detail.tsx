"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Archive, ArchiveRestore, Ellipsis, MessageCircle, Phone, Printer } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { useAgendaSheets } from "@/components/agenda/agenda-sheets";
import { useNow } from "@/components/agenda/parts";
import { AlertChips } from "@/components/shared/alert-chips";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { bogotaDateKey } from "@/convex/lib/time";
import { ageFromBirthDate, formatPhone } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";
import { AppointmentsTab } from "./appointments-tab";
import { DocumentsTab } from "./documents-tab";
import { FichaTab } from "./ficha-tab";
import { HistoryTab } from "./history-tab";
import { PaymentsTab } from "./payments-tab";
import { SummaryTab } from "./summary-tab";

const TABS = [
  { value: "resumen", label: "Resumen" },
  { value: "ficha", label: "Ficha" },
  { value: "historial", label: "Historial" },
  { value: "citas", label: "Citas" },
  { value: "pagos", label: "Pagos" },
  { value: "documentos", label: "Documentos" },
] as const;
type Tab = (typeof TABS)[number]["value"];

export function ClientDetail({ clientId }: { clientId: Id<"clients"> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const client = useQuery(api.clients.get, { clientId });
  const summary = useQuery(api.clients.summary, { clientId });
  const openSheet = useAgendaSheets();
  const restore = useMutation(api.clients.restore);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const actionsRef = useRef<HTMLButtonElement>(null);
  const now = useNow();

  const tabParam = params.get("tab");
  const tab: Tab = TABS.some((t) => t.value === tabParam) ? (tabParam as Tab) : "resumen";
  const name = client ? `${client.firstName} ${client.lastName}`.trim() : "Cliente";

  const next = summary?.nextAppointment;
  const nextIsToday =
    next && bogotaDateKey(next.start) === bogotaDateKey(now) && (next.status === "scheduled" || next.status === "in_progress");

  // "?nueva=cita|atencion": the client was just created from an appointment or walk-in sheet; reopen it.
  const reopen = params.get("nueva");
  useEffect(() => {
    if (reopen !== "cita" && reopen !== "atencion") return;
    openSheet(reopen === "cita" ? { kind: "create", prefill: { clientId } } : { kind: "walkIn", clientId });
    router.replace(pathname, { scroll: false });
  }, [reopen, clientId, openSheet, router, pathname]);

  function startAttention() {
    if (nextIsToday && next) router.push(`/atencion/${next._id}`);
    else openSheet({ kind: "walkIn", clientId });
  }

  return (
    <>
      <PageHeader
        title={name}
        backHref="/clientes"
        actions={
          client && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button ref={actionsRef} variant="ghost" size="icon" aria-label="Más acciones">
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild className="min-h-11 text-base">
                  <Link href={`/imprimir/ficha/${clientId}`}>
                    <Printer className="size-5" strokeWidth={1.5} />
                    Imprimir ficha
                  </Link>
                </DropdownMenuItem>
                {client.isArchived ? (
                  <DropdownMenuItem
                    className="min-h-11 text-base"
                    onSelect={() => void restore({ clientId }).then(() => toast.success("Cliente restaurado"))}
                  >
                    <ArchiveRestore className="size-5" strokeWidth={1.5} />
                    Restaurar
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem className="min-h-11 text-base" onSelect={() => setArchiveOpen(true)}>
                    <Archive className="size-5" strokeWidth={1.5} />
                    Archivar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
      />
      <PageBody className="flex flex-col gap-6">
        {!client ? (
          <HeaderSkeleton />
        ) : (
          <div className="flex flex-col gap-4">
            {client.isArchived && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-porcelain px-4 py-3">
                <p>Este cliente está archivado. No aparece en la lista ni en la búsqueda.</p>
                <Button variant="secondary" onClick={() => void restore({ clientId }).then(() => toast.success("Cliente restaurado"))}>
                  Restaurar
                </Button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-soft">
              {client.birthDate && <span>{ageFromBirthDate(client.birthDate)} años</span>}
              <span className="tabular-nums">{formatPhone(client.phone)}</span>
            </div>
            <AlertChips client={client} />
            <div className="flex flex-wrap gap-2">
              {!client.isArchived && (
                <>
                  <Button onClick={() => openSheet({ kind: "create", prefill: { clientId } })}>Nueva cita</Button>
                  <Button variant="secondary" onClick={startAttention}>
                    {next?.status === "in_progress" && nextIsToday ? "Continuar atención" : "Iniciar atención"}
                  </Button>
                </>
              )}
              <Button variant="secondary" asChild>
                <a href={whatsappLink(client.phone)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle />
                  WhatsApp
                </a>
              </Button>
              <Button variant="secondary" asChild>
                <a href={`tel:${client.phone}`}>
                  <Phone />
                  Llamar
                </a>
              </Button>
            </div>
          </div>
        )}

        <Tabs
          value={tab}
          onValueChange={(value) => {
            const search = new URLSearchParams(params);
            search.set("tab", value);
            router.replace(`${pathname}?${search}`, { scroll: false });
          }}
          className="gap-6"
        >
          <TabsList variant="line" className="-mx-4 h-auto w-[calc(100%+2rem)] justify-start gap-0 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] sm:mx-0 sm:w-full sm:px-0">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="h-11 flex-none rounded-none px-3 text-base after:hidden data-active:text-plum data-active:shadow-[inset_0_-2px_0_var(--plum)]">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="resumen" className="text-base">
            <SummaryTab clientId={clientId} notes={client?.notes} />
          </TabsContent>
          <TabsContent value="ficha" className="text-base">
            {client ? <FichaTab client={client} /> : <Skeleton className="h-64 w-full" />}
          </TabsContent>
          <TabsContent value="historial" className="text-base">
            <HistoryTab clientId={clientId} />
          </TabsContent>
          <TabsContent value="citas" className="text-base">
            <AppointmentsTab clientId={clientId} archived={client?.isArchived ?? false} />
          </TabsContent>
          <TabsContent value="pagos" className="text-base">
            <PaymentsTab clientId={clientId} />
          </TabsContent>
          <TabsContent value="documentos" className="text-base">
            {client ? <DocumentsTab client={client} /> : <Skeleton className="h-24 w-full" />}
          </TabsContent>
        </Tabs>
      </PageBody>

      {client && (
        <ArchiveDialog
          open={archiveOpen}
          onOpenChange={setArchiveOpen}
          clientId={clientId}
          name={name}
          returnFocusRef={actionsRef}
          onArchived={() => router.push("/clientes")}
        />
      )}
    </>
  );
}

function ArchiveDialog({
  open,
  onOpenChange,
  clientId,
  name,
  returnFocusRef,
  onArchived,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: Id<"clients">;
  name: string;
  returnFocusRef: RefObject<HTMLElement | null>;
  onArchived: () => void;
}) {
  const archive = useMutation(api.clients.archive);
  const restore = useMutation(api.clients.restore);
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    await archive({ clientId });
    toast.success("Cliente archivado", {
      action: { label: "Deshacer", onClick: () => void restore({ clientId }) },
    });
    onOpenChange(false);
    onArchived();
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      returnFocusRef={returnFocusRef}
      title={`¿Archivar a ${name}?`}
      description="Sale de la lista y de la búsqueda. Su ficha, citas y pagos se conservan."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button variant="destructive" onClick={() => void confirm()} disabled={pending}>
            Archivar cliente
          </Button>
        </>
      }
    >
      <span />
    </ResponsiveDialog>
  );
}

function HeaderSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-3">
      <Skeleton className="h-5 w-48" />
      <div className="flex gap-2">
        <Skeleton className="h-11 w-32" />
        <Skeleton className="h-11 w-36" />
      </div>
    </div>
  );
}
