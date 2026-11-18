"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const LENGTH = 6;

type OtpInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Called once all six digits are entered (typed, pasted, or autofilled). */
  onComplete?: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  describedBy?: string;
};

/** One native field for the whole code, so autofill, paste, and text editing work as usual. */
export function OtpInput({ id, value, onChange, onComplete, invalid, disabled, describedBy }: OtpInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  // On mount, and again when a request ends and re-enables the field.
  useEffect(() => {
    if (!disabled) ref.current?.focus();
  }, [disabled]);

  return (
    <input
      ref={ref}
      id={id}
      name="otp"
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      autoCorrect="off"
      autoCapitalize="none"
      spellCheck={false}
      enterKeyHint="go"
      pattern="\d{6}"
      required
      value={value}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onChange={(event) => {
        // Pasted codes may come with spaces or dashes ("123 456").
        const clean = event.target.value.replace(/\D/g, "").slice(0, LENGTH);
        onChange(clean);
        if (clean.length === LENGTH && clean !== value) onComplete?.(clean);
      }}
      className={cn(
        "h-14 w-full min-w-0 rounded-lg border border-field-line bg-surface pl-[0.5em] text-center text-2xl font-medium tracking-[0.5em] tabular-nums outline-none",
        "focus-visible:border-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum",
        "disabled:opacity-60 aria-invalid:border-rose",
      )}
    />
  );
}
