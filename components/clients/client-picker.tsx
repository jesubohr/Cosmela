"use client";

import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Search, UserPlus } from "lucide-react";
import { useDeferredValue, useId, useState } from "react";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { PhoneInput } from "@/components/shared/phone-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatPhone, isValidPhone } from "@/lib/format";

export type PickedClient = { _id: Id<"clients">; name: string; phone: string };

export type ClientPickerProps = {
  value: PickedClient | null;
  onChange: (client: PickedClient | null) => void;
  error?: string;
};

/** Search clients by name, phone, or document, or create one inline (name + phone). */
export function ClientPicker({ value, onChange, error }: ClientPickerProps) {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const term = useDeferredValue(search.trim());
  const results = useQuery(api.clients.pick, value || creating ? "skip" : { search: term });
  const searchId = useId();

  if (value) {
    return (
      <div className="flex min-h-16 items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2">
        <InitialsAvatar name={value.name} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{value.name}</span>
          <span className="text-sm text-ink-soft tabular-nums">{formatPhone(value.phone)}</span>
        </span>
        <Button type="button" variant="ghost" onClick={() => onChange(null)}>
          Cambiar
        </Button>
      </div>
    );
  }

  if (creating) {
    return (
      <InlineCreate
        initial={term}
        onCancel={() => setCreating(false)}
        onCreated={(client) => {
          setCreating(false);
          onChange(client);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute inset-y-0 left-3 my-auto size-5 text-ink-soft" strokeWidth={1.75} />
        <Input
          id={searchId}
          type="search"
          aria-label="Buscar cliente"
          placeholder="Buscar por nombre o teléfono"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-invalid={error ? true : undefined}
          className="pl-10"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-rose">
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
                    <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                    <span className="shrink-0 text-sm text-ink-soft tabular-nums">{formatPhone(client.phone)}</span>
                  </button>
                </li>
              );
            })}
        <li>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex min-h-14 w-full items-center gap-3 px-3 text-left font-medium text-plum hover:bg-lilac"
          >
            <UserPlus aria-hidden className="size-5" strokeWidth={1.75} />
            {term && !/^[\d\s+]+$/.test(term) ? `Crear cliente «${term}»` : "Crear cliente nuevo"}
          </button>
        </li>
      </ul>
    </div>
  );
}

function InlineCreate({
  initial,
  onCancel,
  onCreated,
}: {
  initial: string;
  onCancel: () => void;
  onCreated: (client: PickedClient) => void;
}) {
  const create = useMutation(api.clients.create);
  const isPhone = /^[\d\s+]+$/.test(initial);
  const [first, ...rest] = isPhone ? [""] : initial.split(/\s+/);
  const [firstName, setFirstName] = useState(first ?? "");
  const [lastName, setLastName] = useState(rest.join(" "));
  const [phone, setPhone] = useState(isPhone ? `+57${initial.replace(/\D/g, "").slice(-10)}` : "");
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<PickedClient | null>(null);
  const [pending, setPending] = useState(false);
  const ids = { first: useId(), last: useId(), phone: useId() };

  async function save() {
    setDuplicate(null);
    if (!firstName.trim()) return setError("Escribe el nombre.");
    if (!isValidPhone(phone)) return setError("Escribe un teléfono de 10 dígitos.");
    setError(null);
    setPending(true);
    try {
      const id = await create({ client: { firstName, lastName, phone } });
      onCreated({ _id: id, name: `${firstName.trim()} ${lastName.trim()}`.trim(), phone });
    } catch (err) {
      const data = err instanceof ConvexError ? (err.data as { code: string; message: string; clientId?: Id<"clients">; clientName?: string }) : null;
      setError(data?.message ?? "No pudimos guardar. Revisa tu conexión e intenta de nuevo.");
      if (data?.code === "DUPLICATE_PHONE" && data.clientId) {
        setDuplicate({ _id: data.clientId, name: data.clientName ?? "", phone });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-porcelain p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.first} className="text-base">
            Nombre(s)
          </Label>
          <Input id={ids.first} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="off" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.last} className="text-base">
            Apellidos
          </Label>
          <Input id={ids.last} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="off" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.phone} className="text-base">
          Teléfono (WhatsApp)
        </Label>
        <PhoneInput id={ids.phone} value={phone} onChange={setPhone} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-rose">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {duplicate ? (
          <Button type="button" onClick={() => onCreated(duplicate)}>
            Elegir a {duplicate.name}
          </Button>
        ) : (
          <Button type="button" onClick={() => void save()} disabled={pending}>
            {pending ? "Guardando…" : "Guardar cliente"}
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onCancel}>
          Volver a buscar
        </Button>
      </div>
    </div>
  );
}
