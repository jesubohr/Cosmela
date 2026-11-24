"use client";

import { useQuery } from "convex/react";
import { Search, UserPlus } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useId, useState } from "react";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatPhone } from "@/lib/format";
import type { AfterCreate } from "./client-create-form";

export type PickedClient = { _id: Id<"clients">; name: string; phone: string };

export type ClientPickerProps = {
  value: PickedClient | null;
  onChange: (client: PickedClient | null) => void;
  error?: string;
  /** What to reopen on the new client's page after "Crear cliente nuevo". */
  createFor: AfterCreate;
};

/** Search clients by name, phone, or document. A new client is created on its own page, then the sheet opens again there. */
export function ClientPicker({ value, onChange, error, createFor }: ClientPickerProps) {
  const [search, setSearch] = useState("");
  const term = useDeferredValue(search.trim());
  const results = useQuery(api.clients.pick, value ? "skip" : { search: term });
  const searchId = useId();

  if (value) {
    return (
      <div className="flex min-h-16 items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2">
        <InitialsAvatar name={value.name} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="line-clamp-2 font-medium">{value.name}</span>
          <span className="text-sm text-ink-soft tabular-nums">{formatPhone(value.phone)}</span>
        </span>
        <Button type="button" variant="ghost" onClick={() => onChange(null)}>
          Cambiar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute inset-y-0 left-3 my-auto size-5 text-ink-soft" strokeWidth={1.5} />
        <Input
          id={searchId}
          type="search"
          aria-label="Buscar cliente"
          placeholder="Buscar por nombre o teléfono"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${searchId}-error` : undefined}
          className="pl-10"
        />
      </div>
      {error && (
        <p id={`${searchId}-error`} className="text-sm text-rose">
          {error}
        </p>
      )}
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {results === undefined
          ? Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="flex min-h-14 items-center gap-3 px-3">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-4 w-36" />
              </li>
            ))
          : results.map((client) => {
              const name = `${client.firstName} ${client.lastName}`.trim();
              return (
                <li key={client._id}>
                  <button
                    type="button"
                    onClick={() => onChange({ _id: client._id, name, phone: client.phone })}
                    className="flex min-h-14 w-full items-center gap-3 px-3 text-left hover:bg-porcelain"
                  >
                    <InitialsAvatar name={name} size="sm" />
                    <span className="line-clamp-2 min-w-0 flex-1 font-medium">{name}</span>
                    <span className="shrink-0 text-sm text-ink-soft tabular-nums">{formatPhone(client.phone)}</span>
                  </button>
                </li>
              );
            })}
        <li>
          <Link
            href={`/clientes/nuevo?para=${createFor}`}
            className="flex min-h-14 w-full items-center gap-3 px-3 text-left font-medium text-plum hover:bg-lilac"
          >
            <UserPlus aria-hidden className="size-5" strokeWidth={1.5} />
            Crear cliente nuevo
          </Link>
        </li>
      </ul>
    </div>
  );
}
