import type { Metadata } from "next";
import { PlanSettings } from "@/components/settings/plan-settings";
import { SettingsPage } from "@/components/settings/settings-page";

export const metadata: Metadata = { title: "Plan" };

export default function PlanPage() {
  return (
    <SettingsPage title="Plan">
      <PlanSettings />
    </SettingsPage>
  );
}
