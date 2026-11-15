import type { Metadata } from "next";
import { DataSettings } from "@/components/settings/data-settings";
import { SettingsPage } from "@/components/settings/settings-page";

export const metadata: Metadata = { title: "Datos" };

export default function DatosPage() {
  return (
    <SettingsPage title="Datos">
      <DataSettings />
    </SettingsPage>
  );
}
