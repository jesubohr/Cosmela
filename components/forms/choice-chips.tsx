"use client";

import { Check } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type ChipProps = Omit<ComponentProps<"button">, "type"> & { selected: boolean };

/** Pill choice: lilac with a check when selected (DESIGN.md §6). Set `role` and `aria-*` from the group. */
export function ChoiceChip({ selected, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-base transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        selected ? "border-plum/30 bg-lilac font-medium text-plum" : "border-line bg-surface text-ink hover:bg-porcelain",
        className,
      )}
      {...props}
    >
      {selected && <Check aria-hidden className="-ml-1 size-4" strokeWidth={2} />}
      {children}
    </button>
  );
}

type Option<T> = { value: T; label: string };

type GroupBase = {
  /** Accessible name when no visible `<legend>` labels the group. */
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
};

/** Pick one. Tapping the selected chip again clears it unless `required`. */
export function SingleChoice<T extends string | number | boolean>({
  options,
  value,
  onChange,
  required,
  label,
  labelledBy,
  describedBy,
  invalid,
  disabled,
  className,
}: GroupBase & {
  options: Option<T>[];
  value: T | null | undefined;
  onChange: (value: T | null) => void;
  required?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <ChoiceChip
            key={String(option.value)}
            role="radio"
            aria-checked={selected}
            selected={selected}
            disabled={disabled}
            onClick={() => onChange(selected && !required ? null : option.value)}
          >
            {option.label}
          </ChoiceChip>
        );
      })}
    </div>
  );
}

/** Pick many. */
export function MultiChoice({
  options,
  value,
  onChange,
  label,
  labelledBy,
  describedBy,
  disabled,
  className,
}: GroupBase & {
  options: Option<string>[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {options.map((option) => {
        const selected = value.includes(option.value);
        return (
          <ChoiceChip
            key={option.value}
            aria-pressed={selected}
            selected={selected}
            disabled={disabled}
            onClick={() =>
              onChange(
                selected
                  ? value.filter((item) => item !== option.value)
                  : // Keep the options' order, not the tap order.
                    options.map((o) => o.value).filter((item) => item === option.value || value.includes(item)),
              )
            }
          >
            {option.label}
          </ChoiceChip>
        );
      })}
    </div>
  );
}
