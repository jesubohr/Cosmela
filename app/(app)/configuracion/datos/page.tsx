import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Datos" };

export default function DatosPage() {
  return (
    <>
      <PageHeader title="Datos" backHref="/configuracion" />
      <PageBody />
    </>
  );
}
