"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PhoneInputProps = Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "inputMode"> & {
  /** E.164 ("+573001234567"), a partial value while typing, or "". */
  value: string;
  /** Receives E.164 for Colombian numbers ("+57" + digits typed so far) or "+…" for other countries. */
  onChange: (value: string) => void;
};

/**
 * Colombian mobile by default: shows "+57" and formats "300 123 4567".
 * Typing "+" first switches to an international number. Validate with `isValidPhone` from lib/format
 * ("Escribe un teléfono de 10 dígitos").
 */
export function PhoneInput({ value, onChange, className, ...props }: PhoneInputProps) {
  const international = value.startsWith("+") && !value.startsWith("+57");
  const display = international ? value : formatLocal(value.replace(/^\+57/, ""));

  return (
    <div className="relative">
      {!international && (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-soft">
          +57
        </span>
      )}
      <Input
        {...props}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={display}
        onChange={(event) => {
          const raw = event.target.value.trim();
          if (raw.startsWith("+")) {
            onChange(`+${raw.replace(/\D/g, "").slice(0, 15)}`);
            return;
          }
          const digits = raw.replace(/\D/g, "").slice(0, 10);
          onChange(digits ? `+57${digits}` : "");
        }}
        className={cn(!international && "pl-12", "tabular-nums", className)}
      />
    </div>
  );
}

function formatLocal(digits: string) {
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean).join(" ");
}
