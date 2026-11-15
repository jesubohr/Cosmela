"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DurationInputProps = Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "inputMode"> & {
  /** Whole number (minutes by default), or null when empty. */
  value: number | null;
  onChange: (value: number | null) => void;
  /** Unit shown inside the input. Defaults to "min". */
  suffix?: string;
};

/** Whole number with a unit suffix ("min" by default) and a numeric keyboard. */
export function DurationInput({ value, onChange, suffix = "min", className, ...props }: DurationInputProps) {
  return (
    <div className="relative">
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value ?? ""}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 3);
          onChange(digits ? Number(digits) : null);
        }}
        className={cn("pr-12 tabular-nums", className)}
      />
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-soft">
        {suffix}
      </span>
    </div>
  );
}
