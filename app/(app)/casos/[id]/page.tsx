import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Caso" };

export default function CasoPage() {
  return (
    <>
      <PageHeader title="Caso" backHref="/casos" />
      <PageBody />
    </>
  );
}
