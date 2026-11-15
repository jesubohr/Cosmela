import type { Metadata } from "next";
import { BookingSettings } from "@/components/settings/booking-settings";
import { SettingsPage } from "@/components/settings/settings-page";

export const metadata: Metadata = { title: "Reservas en línea" };

export default function ReservasPage() {
  return (
    <SettingsPage title="Reservas en línea" adminOnly>
      <BookingSettings />
    </SettingsPage>
  );
}
