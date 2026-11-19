"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";

export function LegacyMinorsWarning() {
  const clients = useQuery(api.clients.legacyMinors, {});
  if (!clients?.length) return null;
  return (
    <div role="status" className="mb-6 flex max-w-[70ch] flex-col gap-1 rounded-card bg-amber-soft p-4">
      <p>Hay registros de posibles menores que requieren revisión. El tratamiento de datos sensibles está restringido. Coordina su custodia con asesoría legal.</p>
      <ul className="flex flex-col">
        {clients.map((client) => (
          <li key={client._id}>
            <Link className="inline-flex min-h-11 items-center font-medium underline underline-offset-4" href={`/clientes/${client._id}`}>
              {client.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
