"use client";

import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { errorMessage } from "@/components/forms/error-message";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";

export function ReminderSettings() {
  const org = useQuery(api.orgs.get);
  const updateReminders = useMutation(api.orgs.updateReminders).withOptimisticUpdate((store, { email }) => {
    const current = store.getQuery(api.orgs.get, {});
    if (current) store.setQuery(api.orgs.get, {}, { ...current, reminders: { email } });
  });

  if (!org) return <Skeleton aria-busy className="h-16 w-full" />;

  async function toggle(email: boolean) {
    try {
      await updateReminders({ email });
      toast.success(email ? "Recordatorios activados" : "Recordatorios desactivados");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="reminder-email" className="text-base leading-snug">
          Recordatorio por correo el día anterior
        </Label>
        <p id="reminder-email-help" className="text-sm text-ink-soft">
          Lo enviamos entre las 7:00 a. m. y las 8:00 p. m. a los clientes que tienen correo.
        </p>
      </div>
      <Switch
        id="reminder-email"
        aria-describedby="reminder-email-help"
        checked={org.reminders.email}
        onCheckedChange={(email) => void toggle(email)}
        className="mt-1"
      />
    </div>
  );
}
