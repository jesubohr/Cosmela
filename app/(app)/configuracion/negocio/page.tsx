import type { Metadata } from "next";
import { BusinessSettings } from "@/components/settings/business-settings";
import { SettingsPage } from "@/components/settings/settings-page";

export const metadata: Metadata = { title: "Negocio" };

export default function NegocioPage() {
  return (
    <SettingsPage title="Negocio" adminOnly>
      <BusinessSettings />
    </SettingsPage>
  );
}
