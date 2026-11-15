import type { Metadata } from "next";
import { AgendaSheets } from "@/components/agenda/agenda-sheets";
import { HoyView } from "@/components/dashboard/hoy-view";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { QuickActions } from "@/components/shell/quick-actions";

export const metadata: Metadata = { title: "Hoy" };

export default function HoyPage() {
  return (
    <>
      <PageHeader title="Hoy" actions={<QuickActions />} />
      <PageBody>
        <AgendaSheets>
          <HoyView />
        </AgendaSheets>
      </PageBody>
    </>
  );
}
