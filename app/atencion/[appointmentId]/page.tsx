import type { Metadata } from "next";
import { AttentionFlow } from "@/components/attention/attention-flow";
import type { Id } from "@/convex/_generated/dataModel";

export const metadata: Metadata = { title: "Atención" };

export default async function AtencionPage({ params }: PageProps<"/atencion/[appointmentId]">) {
  const { appointmentId } = await params;
  return <AttentionFlow appointmentId={appointmentId as Id<"appointments">} />;
}
