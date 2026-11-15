import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Configuración" };

export default function ConfiguracionPage() {
  return (
    <>
      <PageHeader title="Configuración" />
      <PageBody />
    </>
  );
}
