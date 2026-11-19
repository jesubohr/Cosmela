import type { StaffColor } from "@/convex/lib/validators";
import { STAFF_COLORS } from "@/lib/constants";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-8 text-sm",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
} as const;

export type InitialsAvatarProps = {
  /** Full name; renders the first and last initials ("Laura Gómez" → "LG"). */
  name: string;
  /** Staff color key; soft background with strong text. Defaults to plum. */
  color?: StaffColor;
  /** sm 32 px, md 40 px (list rows), lg 48 px. Defaults to md. */
  size?: keyof typeof SIZES;
  className?: string;
};

/** Initials in a circle, colored with a staff color. Decorative: the name is always shown next to it. */
export function InitialsAvatar({ name, color = "plum", size = "md", className }: InitialsAvatarProps) {
  const { soft, strong } = STAFF_COLORS[color];
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-medium select-none", SIZES[size], className)}
      style={{ backgroundColor: soft, color: strong }}
    >
      {initials(name)}
    </span>
  );
}
