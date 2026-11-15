"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActive, MORE_ROUTES, TABS } from "./nav";

/** Phone and tablet navigation (< 1024 px): 64 px + safe area. */
export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-safe lg:hidden"
    >
      <ul className="mx-auto flex h-16 max-w-xl">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/mas" ? MORE_ROUTES.some((route) => isActive(pathname, route)) : isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-sm font-medium",
                  active ? "text-plum" : "text-ink-soft",
                )}
              >
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", active && "bg-lilac")}>
                  <Icon className="size-5" strokeWidth={1.75} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
