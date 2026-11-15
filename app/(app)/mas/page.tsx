import type { Metadata } from "next";
import { MoreMenu } from "@/components/shell/more-menu";
import { PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Más" };

export default function MasPage() {
  return (
    <>
      <PageHeader title="Más" />
      <PageBody>
        <MoreMenu />
      </PageBody>
    </>
  );
}
