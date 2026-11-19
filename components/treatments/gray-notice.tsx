import { Info } from "lucide-react";
import { GRAY_SCOPE_NOTICE } from "@/data/treatment-templates";
import { cn } from "@/lib/utils";

/** Regulatory notice for templates with `scope: "gray"`. Never shown in the attention flow. */
export function GrayNotice({ className }: { className?: string }) {
  return (
    <p className={cn("flex max-w-[70ch] gap-2 rounded-lg bg-amber-soft px-3 py-2 text-sm text-amber", className)}>
      <Info aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
      {GRAY_SCOPE_NOTICE}
    </p>
  );
}
