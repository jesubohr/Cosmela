import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Tratamiento" };

export default function TratamientoPage() {
  return (
    <>
      <PageHeader title="Tratamiento" backHref="/tratamientos" />
      <PageBody />
    </>
  );
}
