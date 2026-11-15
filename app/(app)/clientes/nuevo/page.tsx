import type { Metadata } from "next";
import { ClientCreateForm } from "@/components/clients/client-create-form";
import { PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Nuevo cliente" };

export default function NuevoClientePage() {
  return (
    <>
      <PageHeader title="Nuevo cliente" backHref="/clientes" />
      <PageBody>
        <ClientCreateForm />
      </PageBody>
    </>
  );
}
