"use client";

import { cn } from "@/lib/utils";

/** Two or three mutually exclusive views, e.g. "Editar" / "Vista previa". */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  /** Accessible name of the group. */
  label: string;
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex w-fit rounded-full border border-line bg-surface p-1">
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "min-h-11 rounded-full px-4 text-base font-medium transition-colors",
            value === option ? "bg-lilac text-plum" : "text-ink-soft hover:text-ink",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
