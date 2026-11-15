"use client";

import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { PRIMARY_NAV, SECONDARY_NAV, TABS } from "./nav";
import { useSignOut } from "./use-sign-out";
import { useViewer } from "./viewer";

const tabHrefs = new Set(TABS.map((tab) => tab.href));

/** Phone "Más" page: the sidebar items that have no bottom tab, plus the user and sign out. */
export function MoreMenu() {
  const viewer = useViewer();
  const signOut = useSignOut();
  const isAdmin = viewer.member.role === "admin";
  const items = [...PRIMARY_NAV, ...SECONDARY_NAV].filter(
    (item) => !tabHrefs.has(item.href) && (!item.adminOnly || isAdmin),
  );
  const name = viewer.member.name || viewer.user.email;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/configuracion/perfil"
        className="flex min-h-16 items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3"
      >
        <InitialsAvatar name={name} color={viewer.member.color} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{name}</span>
          <span className="truncate text-sm text-ink-soft">{viewer.org.name}</span>
        </span>
        <ChevronRight className="size-5 text-ink-soft" strokeWidth={1.75} />
      </Link>

      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {items.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-14 items-center gap-3 px-4 hover:bg-porcelain">
              <Icon className="size-5 text-plum" strokeWidth={1.75} />
              <span className="flex-1 font-medium">{label}</span>
              <ChevronRight className="size-5 text-ink-soft" strokeWidth={1.75} />
            </Link>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => void signOut()}
        className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-surface px-4 text-left font-medium text-rose hover:bg-rose-soft"
      >
        <LogOut className="size-5" strokeWidth={1.75} />
        Cerrar sesión
      </button>
    </div>
  );
}
