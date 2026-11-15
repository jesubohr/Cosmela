import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  /** Page title in Newsreader, sentence case. */
  title: string;
  /** Right-aligned actions, e.g. `<QuickActions />` or a primary button. */
  actions?: ReactNode;
  /** Shows a back link before the title (detail pages). */
  backHref?: string;
  className?: string;
};

/** Sticky 56 px page header. Render it first in every page inside `app/(app)`, before any data loads. */
export function PageHeader({ title, actions, backHref, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 border-b border-line bg-porcelain/95 backdrop-blur supports-[backdrop-filter]:bg-porcelain/85",
        className,
      )}
    >
      <div className="flex h-14 max-w-[1120px] items-center gap-2 px-4 lg:h-16 lg:px-8">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Volver"
            className="-ml-2 inline-flex size-11 items-center justify-center rounded-lg text-ink hover:bg-lilac"
          >
            <ChevronLeft className="size-5" strokeWidth={1.75} />
          </Link>
        )}
        <h1 className="font-display min-w-0 flex-1 truncate text-[1.375rem] leading-tight lg:text-[1.75rem]">{title}</h1>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** Page content container: left-aligned, max 1120 px, 16/32 px gutters. */
export function PageBody({ children, className }: { children?: ReactNode; className?: string }) {
  return <div className={cn("w-full max-w-[1120px] px-4 py-6 lg:px-8 lg:py-8", className)}>{children}</div>;
}
