import type { Metadata } from "next";
import { ReportsView } from "@/components/reports/reports-view";
import { PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Reportes" };

export default function ReportesPage() {
  return (
    <>
      <PageHeader title="Reportes" />
      <PageBody>
        <ReportsView />
      </PageBody>
    </>
  );
}
