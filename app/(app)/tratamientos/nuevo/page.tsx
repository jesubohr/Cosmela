import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Nuevo tratamiento" };

export default function NuevotratamientoPage() {
  return (
    <>
      <PageHeader title="Nuevo tratamiento" backHref="/tratamientos" />
      <PageBody />
    </>
  );
}
