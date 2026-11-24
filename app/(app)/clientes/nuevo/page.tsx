import type { Metadata } from "next";
import { ClientCreateForm } from "@/components/clients/client-create-form";
import { PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Nuevo cliente" };

export default async function NuevoClientePage({ searchParams }: PageProps<"/clientes/nuevo">) {
  const { para } = await searchParams;
  return (
    <>
      <PageHeader title="Nuevo cliente" backHref="/clientes" />
      <PageBody>
        <ClientCreateForm after={para === "cita" || para === "atencion" ? para : undefined} />
      </PageBody>
    </>
  );
}
