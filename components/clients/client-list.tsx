"use client";

import Link from "next/link";
import { usePaginatedQuery, useQuery } from "convex/react";
import { ChevronRight, Search, TriangleAlert } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { getClientAlerts } from "@/components/shared/alert-chips";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { ClientRow } from "@/convex/clients";
import { formatCalendarDate, formatMoney, formatPhone, formatShortDate, todayKey } from "@/lib/format";
import { Chip } from "./chips";

type Filter = "balance" | "birthday" | null;

const PAGE_SIZE = 30;

export function ClientList() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>(null);
  const term = useDeferredValue(search.trim());
  const month = todayKey().slice(5, 7);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute inset-y-0 left-3 my-auto size-5 text-ink-soft" strokeWidth={1.75} />
        <Input
          type="search"
          aria-label="Buscar clientes"
          placeholder="Nombre, teléfono o documento"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>
      {!term && (
        <div className="flex flex-wrap gap-2">
          <Chip selected={filter === "balance"} aria-pressed={filter === "balance"} onClick={() => setFilter(filter === "balance" ? null : "balance")}>
            Con saldo pendiente
          </Chip>
          <Chip selected={filter === "birthday"} aria-pressed={filter === "birthday"} onClick={() => setFilter(filter === "birthday" ? null : "birthday")}>
            Cumpleaños este mes
          </Chip>
        </div>
      )}
      {filter === "balance" && !term ? (
        <BalanceList />
      ) : (
        <PagedList search={term} birthdayMonth={filter === "birthday" && !term ? month : undefined} />
      )}
    </div>
  );
}

function PagedList({ search, birthdayMonth }: { search: string; birthdayMonth?: string }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.clients.list,
    { search: search || undefined, birthdayMonth },
    { initialNumItems: PAGE_SIZE },
  );

  if (status === "LoadingFirstPage") return <ListSkeleton />;
  if (results.length === 0) {
    if (search) {
      return (
        <EmptyState
          message={`No encontramos clientes con «${search}». Revisa lo que escribiste o crea un cliente nuevo.`}
          action={
            <Button asChild variant="secondary">
              <Link href="/clientes/nuevo">Nuevo cliente</Link>
            </Button>
          }
        />
      );
    }
    if (birthdayMonth) return <EmptyState message="Nadie cumple años este mes." />;
    return (
      <EmptyState
        message="Aún no tienes clientes. Crea el primero para empezar su ficha."
        action={
          <Button asChild>
            <Link href="/clientes/nuevo">Nuevo cliente</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Rows>
        {results.map((client) => (
          <ClientRowLink
            key={client._id}
            client={client}
            meta={
              birthdayMonth ? (
                <BirthdayMeta client={client} />
              ) : client.lastVisitAt ? (
                <span className="flex flex-col items-end">
                  <span>Última visita</span>
                  <span className="tabular-nums">{formatShortDate(client.lastVisitAt)}</span>
                </span>
              ) : null
            }
          />
        ))}
      </Rows>
      {status === "CanLoadMore" && (
        <Button variant="secondary" className="self-start" onClick={() => loadMore(PAGE_SIZE)}>
          Ver más clientes
        </Button>
      )}
      {status === "LoadingMore" && <Skeleton className="h-11 w-40" />}
    </div>
  );
}

function BirthdayMeta({ client }: { client: ClientRow }) {
  return client.birthDate ? <span>{formatCalendarDate(client.birthDate).replace(/ de \d{4}$/, "")}</span> : null;
}

function BalanceList() {
  const rows = useQuery(api.clients.listWithBalance);
  if (rows === undefined) return <ListSkeleton />;
  if (rows.length === 0) return <EmptyState message="Nadie tiene saldo pendiente. Todo está al día." />;
  const total = rows.reduce((sum, row) => sum + row.balance, 0);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-ink-soft">
        Por cobrar: <span className="font-medium text-amber tabular-nums">{formatMoney(total)}</span>
      </p>
      <Rows>
        {rows.map((client) => (
          <ClientRowLink
            key={client._id}
            client={client}
            meta={<span className="font-medium text-amber tabular-nums">{formatMoney(client.balance)}</span>}
          />
        ))}
      </Rows>
    </div>
  );
}

function Rows({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">{children}</ul>;
}

function ClientRowLink({ client, meta }: { client: ClientRow; meta?: React.ReactNode }) {
  const name = `${client.firstName} ${client.lastName}`.trim();
  const hasAlerts = getClientAlerts(client).length > 0;
  return (
    <li>
      <Link href={`/clientes/${client._id}`} className="flex min-h-16 items-center gap-3 px-4 py-2.5 hover:bg-porcelain">
        <InitialsAvatar name={name} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-start gap-1.5">
            <span className="line-clamp-2 font-medium">{name}</span>
            {hasAlerts && (
              <span title="Tiene alertas de salud" className="mt-0.5 shrink-0 text-rose">
                <TriangleAlert aria-hidden className="size-4" strokeWidth={1.75} />
                <span className="sr-only">Tiene alertas de salud</span>
              </span>
            )}
          </span>
          <span className="truncate text-sm text-ink-soft tabular-nums">{formatPhone(client.phone)}</span>
        </span>
        {meta && <span className="shrink-0 text-right text-sm text-ink-soft">{meta}</span>}
        <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-soft" strokeWidth={1.75} />
      </Link>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex min-h-16 items-center gap-3 px-4">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
