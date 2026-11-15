import { CalendarDays, ChartColumn, Droplet, Ellipsis, FolderOpen, Settings, SunMedium, Users, UsersRound, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean };

/** Desktop sidebar, top group. */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/hoy", label: "Hoy", icon: SunMedium },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/casos", label: "Casos", icon: FolderOpen },
  { href: "/tratamientos", label: "Tratamientos", icon: Droplet },
  { href: "/reportes", label: "Reportes", icon: ChartColumn, adminOnly: true },
];

/** Desktop sidebar, bottom group; also listed on the phone "Más" page. */
export const SECONDARY_NAV: NavItem[] = [
  { href: "/configuracion/equipo", label: "Equipo", icon: UsersRound, adminOnly: true },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

/** Phone bottom tabs. */
export const TABS: NavItem[] = [
  { href: "/hoy", label: "Hoy", icon: SunMedium },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/casos", label: "Casos", icon: FolderOpen },
  { href: "/mas", label: "Más", icon: Ellipsis },
];

/** Routes reached from the "Más" tab, so the tab stays active there. */
export const MORE_ROUTES = ["/mas", "/tratamientos", "/reportes", "/configuracion"];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
