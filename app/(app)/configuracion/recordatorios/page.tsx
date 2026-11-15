import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Recordatorios" };

export default function RecordatoriosPage() {
  return (
    <>
      <PageHeader title="Recordatorios" backHref="/configuracion" />
      <PageBody />
    </>
  );
}
