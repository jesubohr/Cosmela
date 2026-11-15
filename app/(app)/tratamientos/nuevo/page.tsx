import type { Metadata } from "next";
import { NewTreatment } from "@/components/treatments/new-treatment";

export const metadata: Metadata = { title: "Nuevo tratamiento" };

export default function NuevoTratamientoPage() {
  return <NewTreatment />;
}
