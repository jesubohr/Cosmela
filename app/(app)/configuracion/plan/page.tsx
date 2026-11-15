import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Plan" };

export default function PlanPage() {
  return (
    <>
      <PageHeader title="Plan" backHref="/configuracion" />
      <PageBody />
    </>
  );
}
