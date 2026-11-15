import type { Metadata } from "next";
import { TreatmentList } from "@/components/treatments/treatment-list";

export const metadata: Metadata = { title: "Tratamientos" };

export default function TratamientosPage() {
  return <TreatmentList />;
}
