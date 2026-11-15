import type { Metadata } from "next";
import { SessionDetail } from "@/components/cases/session-detail";
import type { Id } from "@/convex/_generated/dataModel";

export const metadata: Metadata = { title: "Sesión" };

export default async function SesionPage({ params }: PageProps<"/casos/[id]/sesiones/[sessionId]">) {
  const { id, sessionId } = await params;
  return <SessionDetail caseId={id} sessionId={sessionId as Id<"sessions">} />;
}
