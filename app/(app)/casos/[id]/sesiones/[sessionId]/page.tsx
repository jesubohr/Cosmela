import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Sesión" };

export default async function SesionPage({ params }: PageProps<"/casos/[id]/sesiones/[sessionId]">) {
  const { id } = await params;
  return (
    <>
      <PageHeader title="Sesión" backHref={`/casos/${id}`} />
      <PageBody />
    </>
  );
}
