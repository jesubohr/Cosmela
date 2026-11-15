"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

const LENGTH = 6;

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Called once all six digits are entered (typed or pasted). */
  onComplete?: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  describedBy?: string;
};

/** Six one-digit boxes: auto-advance, backspace to the previous box, paste of the whole code, numeric keyboard. */
export function OtpInput({ value, onChange, onComplete, invalid, disabled, describedBy }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: LENGTH }, (_, index) => value[index] ?? "");

  function update(next: string, focusIndex: number) {
    const clean = next.replace(/\D/g, "").slice(0, LENGTH);
    onChange(clean);
    refs.current[Math.min(focusIndex, LENGTH - 1)]?.focus();
    if (clean.length === LENGTH) onComplete?.(clean);
  }

  return (
    <div role="group" aria-label="Código de 6 dígitos" className="flex gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          value={digit}
          disabled={disabled}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={index === 0 ? LENGTH : 1}
          aria-label={`Dígito ${index + 1}`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onFocus={(event) => event.target.select()}
          onChange={(event) => {
            const typed = event.target.value.replace(/\D/g, "");
            if (!typed) return;
            // A full code can arrive through autofill or paste in any box.
            if (typed.length > 1) {
              update(typed, typed.length);
              return;
            }
            const next = (value.slice(0, index) + typed + value.slice(index + 1)).slice(0, LENGTH);
            update(next, index + 1);
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace") {
              event.preventDefault();
              if (digit) update(value.slice(0, index) + value.slice(index + 1), index);
              else if (index > 0) update(value.slice(0, index - 1) + value.slice(index), index - 1);
            } else if (event.key === "ArrowLeft" && index > 0) {
              refs.current[index - 1]?.focus();
            } else if (event.key === "ArrowRight" && index < LENGTH - 1) {
              refs.current[index + 1]?.focus();
            }
          }}
          onPaste={(event) => {
            event.preventDefault();
            const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
            if (pasted) update(pasted, pasted.length);
          }}
          className={cn(
            "h-14 w-full min-w-0 rounded-lg border border-input bg-surface text-center text-2xl font-medium tabular-nums outline-none",
            "focus-visible:border-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum",
            "disabled:opacity-60 aria-invalid:border-rose",
          )}
        />
      ))}
    </div>
  );
}
