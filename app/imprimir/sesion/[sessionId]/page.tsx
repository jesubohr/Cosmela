import type { Metadata } from "next";
import { PrintSession } from "@/components/cases/print-views";
import type { Id } from "@/convex/_generated/dataModel";

export const metadata: Metadata = { title: "Registro de atención" };

export default async function ImprimirSesionPage({ params }: PageProps<"/imprimir/sesion/[sessionId]">) {
  const { sessionId } = await params;
  return <PrintSession sessionId={sessionId as Id<"sessions">} />;
}
