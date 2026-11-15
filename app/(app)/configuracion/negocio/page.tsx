import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Negocio" };

export default function NegocioPage() {
  return (
    <>
      <PageHeader title="Negocio" backHref="/configuracion" />
      <PageBody />
    </>
  );
}
