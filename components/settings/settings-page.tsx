"use client";

import { Bell, CalendarCheck, ChevronRight, CreditCard, Database, LogOut, Store, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { useSignOut } from "@/components/shell/use-sign-out";
import { useViewer } from "@/components/shell/viewer";
import { cn } from "@/lib/utils";

type Section = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean; salonOnly?: boolean };

export const SETTINGS_SECTIONS: Section[] = [
  { href: "/configuracion/perfil", label: "Mi perfil", icon: UserRound },
  { href: "/configuracion/negocio", label: "Negocio", icon: Store, adminOnly: true },
  { href: "/configuracion/reservas", label: "Reservas en línea", icon: CalendarCheck, adminOnly: true },
  { href: "/configuracion/recordatorios", label: "Recordatorios", icon: Bell, adminOnly: true },
  { href: "/configuracion/equipo", label: "Equipo", icon: UsersRound, adminOnly: true, salonOnly: true },
  { href: "/configuracion/plan", label: "Plan", icon: CreditCard },
  { href: "/configuracion/datos", label: "Datos", icon: Database },
];

function useSections() {
  const { member, org } = useViewer();
  return SETTINGS_SECTIONS.filter(
    (section) => (!section.adminOnly || member.role === "admin") && (!section.salonOnly || org.kind === "salon"),
  );
}

export type SettingsPageProps = {
  title: string;
  /** Sub-nav item to highlight; defaults to the current path. */
  activeHref?: string;
  /** Shows a notice instead of `children` to staff. */
  adminOnly?: boolean;
  actions?: ReactNode;
  children: ReactNode;
};

/**
 * A Configuración section: header (with a back link on phones) and, from 1024 px,
 * a left sub-nav next to the content.
 */
export function SettingsPage({ title, activeHref, adminOnly, actions, children }: SettingsPageProps) {
  const pathname = usePathname();
  const isAdmin = useViewer().member.role === "admin";

  return (
    <>
      <PageHeader
        title={title}
        backHref="/configuracion"
        actions={actions}
        // The sub-nav replaces the back link on desktop.
        className="lg:[&_a[aria-label=Volver]]:hidden"
      />
      <PageBody className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
        <SettingsNav activeHref={activeHref ?? pathname} />
        <div className="min-w-0 max-w-2xl">
          {adminOnly && !isAdmin ? <EmptyState message="Solo un administrador puede cambiar esta configuración." /> : children}
        </div>
      </PageBody>
    </>
  );
}

function SettingsNav({ activeHref }: { activeHref: string }) {
  const sections = useSections();
  const signOut = useSignOut();

  return (
    <nav aria-label="Configuración" className="hidden lg:block">
      <ul className="sticky top-24 flex flex-col gap-1">
        {sections.map(({ href, label, icon: Icon }) => {
          const active = href === activeHref;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 font-medium",
                  active ? "bg-lilac text-plum" : "text-ink hover:bg-lilac/60",
                )}
              >
                <Icon className="size-5 shrink-0" strokeWidth={1.75} />
                {label}
              </Link>
            </li>
          );
        })}
        <li className="mt-4 border-t border-line pt-4">
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left font-medium text-rose hover:bg-rose-soft"
          >
            <LogOut className="size-5 shrink-0" strokeWidth={1.75} />
            Cerrar sesión
          </button>
        </li>
      </ul>
    </nav>
  );
}

/** Phone /configuracion: the sections as a list, plus sign out. */
export function SettingsMenu() {
  const sections = useSections();
  const signOut = useSignOut();

  return (
    <div className="flex flex-col gap-6">
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {sections.map(({ href, label, icon: Icon }) => (
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
        className="flex min-h-14 items-center gap-3 rounded-card border border-line bg-surface px-4 text-left font-medium text-rose hover:bg-rose-soft"
      >
        <LogOut className="size-5" strokeWidth={1.75} />
        Cerrar sesión
      </button>
    </div>
  );
}

/** A titled block inside a settings page. */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 border-b border-line pb-10 last:border-b-0 last:pb-0">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">{title}</h2>
        {description && <p className="max-w-[70ch] text-ink-soft">{description}</p>}
      </div>
      {children}
    </section>
  );
}
