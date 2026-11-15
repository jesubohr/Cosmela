"use client";

import { PageBody, PageHeader } from "@/components/shell/page-header";
import { useIsMobile } from "@/hooks/use-mobile";
import { ProfileSettings } from "./profile-settings";
import { SettingsMenu, SettingsPage } from "./settings-page";

/** Phone: the list of sections. Desktop: the sub-nav with Mi perfil open. */
export function SettingsIndex() {
  const isPhone = useIsMobile(1024);
  if (isPhone) {
    return (
      <>
        <PageHeader title="Configuración" />
        <PageBody>
          <SettingsMenu />
        </PageBody>
      </>
    );
  }
  return (
    <SettingsPage title="Mi perfil" activeHref="/configuracion/perfil">
      <ProfileSettings />
    </SettingsPage>
  );
}
