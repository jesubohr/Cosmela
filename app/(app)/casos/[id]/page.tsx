import type { Metadata } from "next";
import { AgendaSheets } from "@/components/agenda/agenda-sheets";
import { CaseDetail } from "@/components/cases/case-detail";
import type { Id } from "@/convex/_generated/dataModel";

export const metadata: Metadata = { title: "Caso" };

export default async function CasoPage({ params }: PageProps<"/casos/[id]">) {
  const { id } = await params;
  return (
    <AgendaSheets>
      <CaseDetail caseId={id as Id<"cases">} />
    </AgendaSheets>
  );
}
