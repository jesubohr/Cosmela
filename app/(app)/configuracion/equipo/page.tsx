import type { Metadata } from "next";
import { TeamPage } from "@/components/settings/team-page";

export const metadata: Metadata = { title: "Equipo" };

export default function EquipoPage() {
  return <TeamPage />;
}
