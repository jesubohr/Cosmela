"use client";

import { Check } from "lucide-react";
import { STAFF_COLORS as COLOR_KEYS, type StaffColor } from "@/convex/lib/validators";
import { STAFF_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** The 8 calendar colors as swatches (staff and treatments). */
export function ColorPicker({
  value,
  onChange,
  labelledBy,
  disabled,
}: {
  value: StaffColor;
  onChange: (color: StaffColor) => void;
  labelledBy?: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid w-fit grid-cols-4 gap-3 sm:flex sm:flex-wrap sm:gap-2">
      {COLOR_KEYS.map((color) => {
        const { label, soft, strong } = STAFF_COLORS[color];
        const selected = color === value;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={() => onChange(color)}
            className={cn(
              "flex size-11 items-center justify-center rounded-full border-2 transition-shadow disabled:cursor-not-allowed disabled:opacity-50",
              selected ? "ring-2 ring-offset-2 ring-offset-background" : "border-transparent",
            )}
            style={{ backgroundColor: soft, borderColor: selected ? strong : soft, ["--tw-ring-color" as string]: strong }}
          >
            <span className="flex size-5 items-center justify-center rounded-full" style={{ backgroundColor: strong }}>
              {selected && <Check aria-hidden className="size-3.5 text-on-solid" strokeWidth={2.5} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
