import type { Metadata } from "next";
import { ClientList } from "@/components/clients/client-list";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { QuickActions } from "@/components/shell/quick-actions";

export const metadata: Metadata = { title: "Clientes" };

export default function ClientesPage() {
  return (
    <>
      <PageHeader title="Clientes" actions={<QuickActions />} />
      <PageBody>
        <ClientList />
      </PageBody>
    </>
  );
}
