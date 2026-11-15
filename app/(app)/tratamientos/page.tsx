import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Tratamientos" };

export default function TratamientosPage() {
  return (
    <>
      <PageHeader title="Tratamientos" />
      <PageBody />
    </>
  );
}
