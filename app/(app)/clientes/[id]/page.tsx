import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Cliente" };

export default function ClientePage() {
  return (
    <>
      <PageHeader title="Cliente" backHref="/clientes" />
      <PageBody />
    </>
  );
}
