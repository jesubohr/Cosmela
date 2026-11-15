import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Reservas en línea" };

export default function ReservasenlineaPage() {
  return (
    <>
      <PageHeader title="Reservas en línea" backHref="/configuracion" />
      <PageBody />
    </>
  );
}
