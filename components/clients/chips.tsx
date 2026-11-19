"use client";

import { Check } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type ChipOption<T> = { value: T; label: string };

type ChipProps = Omit<ComponentProps<"button">, "type"> & { selected: boolean };

/** Pill choice: lilac with a check when selected (DESIGN.md §6). */
export function Chip({ selected, className, children, ...props }: ChipProps) {
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
      {selected && <Check aria-hidden className="-ml-1 size-4" />}
      {children}
    </button>
  );
}

type GroupProps = { label?: string; labelledBy?: string; disabled?: boolean; className?: string };

/** Pick one. Tapping the selected chip again clears it unless `required`. */
export function SingleChips<T extends string | number | boolean>({
  options,
  value,
  onChange,
  required,
  label,
  labelledBy,
  disabled,
  className,
}: GroupProps & {
  options: ChipOption<T>[];
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  required?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} aria-labelledby={labelledBy} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Chip
            key={String(option.value)}
            role="radio"
            aria-checked={selected}
            selected={selected}
            disabled={disabled}
            onClick={() => onChange(selected && !required ? undefined : option.value)}
          >
            {option.label}
          </Chip>
        );
      })}
    </div>
  );
}

/**
 * Pick many, with an explicit "Ninguna" chip that clears the others.
 * `none` is that answer; an empty list with `none: false` means "not answered".
 */
export function MultiChipsWithNone<T extends string>({
  options,
  value,
  none,
  onChange,
  noneLabel = "Ninguna",
  label,
  labelledBy,
  disabled,
  className,
}: GroupProps & {
  options: ChipOption<T>[];
  value: T[];
  none: boolean;
  onChange: (value: T[], none: boolean) => void;
  noneLabel?: string;
}) {
  return (
    <div role="group" aria-label={label} aria-labelledby={labelledBy} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const selected = value.includes(option.value);
        return (
          <Chip
            key={option.value}
            aria-pressed={selected}
            selected={selected}
            disabled={disabled}
            onClick={() =>
              onChange(
                selected
                  ? value.filter((item) => item !== option.value)
                  : options.map((o) => o.value).filter((item) => item === option.value || value.includes(item)),
                false,
              )
            }
          >
            {option.label}
          </Chip>
        );
      })}
      <Chip aria-pressed={none} selected={none} disabled={disabled} onClick={() => onChange([], !none)}>
        {noneLabel}
      </Chip>
    </div>
  );
}
