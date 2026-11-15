import type { Metadata } from "next";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { SettingsPage } from "@/components/settings/settings-page";

export const metadata: Metadata = { title: "Mi perfil" };

export default function PerfilPage() {
  return (
    <SettingsPage title="Mi perfil">
      <ProfileSettings />
    </SettingsPage>
  );
}
