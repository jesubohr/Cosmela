import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Casos" };

export default function CasosPage() {
  return (
    <>
      <PageHeader title="Casos" />
      <PageBody />
    </>
  );
}
