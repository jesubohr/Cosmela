import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { QuickActions } from "@/components/shell/quick-actions";

export const metadata: Metadata = { title: "Agenda" };

export default function AgendaPage() {
  return (
    <>
      <PageHeader title="Agenda" actions={<QuickActions />} />
      <PageBody />
    </>
  );
}
