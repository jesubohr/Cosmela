import type { Metadata } from "next";
import { Suspense } from "react";
import { ClientDetail } from "@/components/clients/client-detail";
import { PageHeader } from "@/components/shell/page-header";
import type { Id } from "@/convex/_generated/dataModel";

export const metadata: Metadata = { title: "Cliente" };

export default async function ClientePage({ params }: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  return (
    <Suspense fallback={<PageHeader title="Cliente" backHref="/clientes" />}>
      <ClientDetail clientId={id as Id<"clients">} />
    </Suspense>
  );
}
