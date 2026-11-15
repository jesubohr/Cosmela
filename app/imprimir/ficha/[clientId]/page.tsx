import type { Metadata } from "next";
import { PrintFicha } from "@/components/cases/print-views";
import type { Id } from "@/convex/_generated/dataModel";

export const metadata: Metadata = { title: "Ficha clínica" };

export default async function ImprimirFichaPage({ params }: PageProps<"/imprimir/ficha/[clientId]">) {
  const { clientId } = await params;
  return <PrintFicha clientId={clientId as Id<"clients">} />;
}
