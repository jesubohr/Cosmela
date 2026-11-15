"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { groupThousands } from "@/lib/format";
import { cn } from "@/lib/utils";

export type MoneyInputProps = Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "inputMode"> & {
  /** Integer COP, or null when empty. */
  value: number | null;
  onChange: (value: number | null) => void;
};

/** COP amount with a "$" prefix and thousands dots while typing ("85.000"). Numeric keyboard on phones. */
export function MoneyInput({ value, onChange, className, ...props }: MoneyInputProps) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-soft">
        $
      </span>
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value === null ? "" : groupThousands(value)}
        onChange={(event) => {
          const input = event.target;
          const digitsBeforeCaret = input.value.slice(0, input.selectionStart ?? input.value.length).replace(/\D/g, "").length;
          const digits = input.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 12);
          onChange(digits === "" ? null : Number(digits));
          // Keep the caret after the same digit once the dots are re-inserted.
          requestAnimationFrame(() => {
            const formatted = input.value;
            let seen = 0;
            let position = 0;
            while (position < formatted.length && seen < digitsBeforeCaret) {
              if (/\d/.test(formatted[position])) seen++;
              position++;
            }
            input.setSelectionRange(position, position);
          });
        }}
        className={cn("pl-7 tabular-nums", className)}
      />
    </div>
  );
}
