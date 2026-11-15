import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Mi perfil" };

export default function MiperfilPage() {
  return (
    <>
      <PageHeader title="Mi perfil" backHref="/configuracion" />
      <PageBody />
    </>
  );
}
