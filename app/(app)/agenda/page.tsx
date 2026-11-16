import type { Metadata } from "next";
import { Suspense } from "react";
import { AgendaView } from "@/components/agenda/agenda-view";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { QuickActions } from "@/components/shell/quick-actions";

export const metadata: Metadata = { title: "Agenda" };

export default function AgendaPage() {
  return (
    <>
      <PageHeader title="Agenda" actions={<QuickActions />} />
      <PageBody>
        <Suspense>
          <AgendaView />
        </Suspense>
      </PageBody>
    </>
  );
}
