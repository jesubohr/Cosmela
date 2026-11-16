import type { Metadata } from "next";
import { CaseDetail } from "@/components/cases/case-detail";
import type { Id } from "@/convex/_generated/dataModel";

export const metadata: Metadata = { title: "Caso" };

export default async function CasoPage({ params }: PageProps<"/casos/[id]">) {
  const { id } = await params;
  return <CaseDetail caseId={id as Id<"cases">} />;
}
