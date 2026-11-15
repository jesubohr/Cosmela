"use client";

import { useQuery } from "convex/react";
import { useEffect, useState, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { AppointmentStatus } from "@/convex/lib/validators";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Sticky action bar at the bottom of a `ResponsiveDialog` body. Primary action last. */
export function SheetActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex flex-wrap justify-end gap-2 border-t border-line bg-popover px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:-mx-6 md:px-6 [&>*]:flex-1 md:[&>*]:flex-none">
      {children}
    </div>
  );
}

export function FieldBlock({ label, htmlFor, children, error, className }: {
  label: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  error?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {htmlFor ? (
        <Label htmlFor={htmlFor} className="text-base">
          {label}
        </Label>
      ) : (
        <span className="text-base font-medium">{label}</span>
      )}
      {children}
      {error && (
        <p role="alert" className="text-sm text-rose">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl bg-rose-soft px-4 py-3 text-rose">
      {children}
    </p>
  );
}

const STATUS_TONES: Record<AppointmentStatus, string> = {
  requested: "bg-amber-soft text-amber",
  scheduled: "bg-lilac text-plum",
  in_progress: "bg-lilac text-plum",
  completed: "bg-sage-soft text-sage",
  cancelled: "bg-porcelain text-ink-soft",
  no_show: "bg-rose-soft text-rose",
};

export function StatusChip({ status, className }: { status: AppointmentStatus; className?: string }) {
  return (
    <span className={cn("inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium", STATUS_TONES[status], className)}>
      {status === "in_progress" && <span aria-hidden className="size-2 animate-pulse rounded-full bg-plum" />}
      {APPOINTMENT_STATUS_LABELS[status]}
    </span>
  );
}

/** Members and treatments for the pickers (`appointments.formOptions`). */
export function useFormOptions() {
  return useQuery(api.appointments.formOptions);
}
export type FormOptions = NonNullable<ReturnType<typeof useFormOptions>>;

export function MemberSelect({
  id,
  members,
  value,
  onChange,
}: {
  id?: string;
  members: FormOptions["members"];
  value: Id<"members"> | undefined;
  onChange: (value: Id<"members">) => void;
}) {
  return (
    <Select value={value ?? ""} onValueChange={(v) => onChange(v as Id<"members">)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Elige un profesional" />
      </SelectTrigger>
      <SelectContent>
        {members.map((member) => (
          <SelectItem key={member._id} value={member._id} className="min-h-11 text-base">
            {member.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Re-renders every minute; returns the current epoch ms. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** "1 h 30 min", "45 min". */
export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** First line of a ConvexError's Spanish message, or a generic one. */
export function errorText(error: unknown) {
  const data = (error as { data?: { message?: string } } | null)?.data;
  return data?.message ?? "No pudimos guardar. Revisa tu conexión e intenta de nuevo.";
}
