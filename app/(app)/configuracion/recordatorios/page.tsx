import type { Metadata } from "next";
import { ReminderSettings } from "@/components/settings/reminder-settings";
import { SettingsPage } from "@/components/settings/settings-page";

export const metadata: Metadata = { title: "Recordatorios" };

export default function RecordatoriosPage() {
  return (
    <SettingsPage title="Recordatorios" adminOnly>
      <ReminderSettings />
    </SettingsPage>
  );
}
