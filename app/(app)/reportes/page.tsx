import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Reportes" };

export default function ReportesPage() {
  return (
    <>
      <PageHeader title="Reportes" />
      <PageBody />
    </>
  );
}
