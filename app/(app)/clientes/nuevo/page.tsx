import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Nuevo cliente" };

export default function NuevoclientePage() {
  return (
    <>
      <PageHeader title="Nuevo cliente" backHref="/clientes" />
      <PageBody />
    </>
  );
}
