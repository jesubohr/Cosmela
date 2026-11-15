import type { Metadata } from "next";
import { SettingsIndex } from "@/components/settings/settings-index";

export const metadata: Metadata = { title: "Configuración" };

export default function ConfiguracionPage() {
  return <SettingsIndex />;
}
