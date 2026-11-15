"use client";

import { useViewer } from "@/components/shell/viewer";
import { SettingsPage } from "./settings-page";
import { InviteButton, TeamSettings } from "./team-settings";

/** Equipo, with the invite action in the header for admins. */
export function TeamPage() {
  const isAdmin = useViewer().member.role === "admin";
  return (
    <SettingsPage title="Equipo" adminOnly actions={isAdmin && <InviteButton />}>
      <TeamSettings />
    </SettingsPage>
  );
}
