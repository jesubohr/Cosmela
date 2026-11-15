import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Equipo" };

export default function EquipoPage() {
  return (
    <>
      <PageHeader title="Equipo" backHref="/configuracion" />
      <PageBody />
    </>
  );
}
