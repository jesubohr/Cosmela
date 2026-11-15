import type { Metadata } from "next";
import { TreatmentEditor } from "@/components/treatments/treatment-editor";
import type { Id } from "@/convex/_generated/dataModel";

export const metadata: Metadata = { title: "Tratamiento" };

export default async function TratamientoPage({ params }: PageProps<"/tratamientos/[id]">) {
  const { id } = await params;
  return <TreatmentEditor id={id as Id<"treatments">} />;
}
