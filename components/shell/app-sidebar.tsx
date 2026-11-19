"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, LogOut, PanelLeft, UserRound } from "lucide-react";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { ROLE_LABELS } from "@/lib/constants";
import { isActive, PRIMARY_NAV, SECONDARY_NAV, visibleFor, type NavItem } from "./nav";
import { useSignOut } from "./use-sign-out";
import type { Viewer } from "./viewer";

/** Desktop navigation (≥ 1024 px): 240 px, collapsible to icons. `viewer` is undefined while loading. */
export function AppSidebar({ viewer }: { viewer: Viewer | undefined }) {
  const visible = (items: NavItem[]) => visibleFor(items, { role: viewer?.member.role, kind: viewer?.org.kind });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center px-3 group-data-[collapsible=icon]:px-2.5">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/hoy"
            className="font-display truncate px-2 text-[1.75rem] leading-none text-plum group-data-[collapsible=icon]:hidden"
          >
            Cosmela
          </Link>
          <CollapseButton />
        </div>
      </SidebarHeader>
      <SidebarContent className="justify-between">
        <NavGroup items={visible(PRIMARY_NAV)} />
        <NavGroup items={visible(SECONDARY_NAV)} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        {viewer && <UserMenu viewer={viewer} />}
      </SidebarFooter>
    </Sidebar>
  );
}

function NavGroup({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  // The longest matching href wins, so "Configuración" stays off on /configuracion/equipo.
  const activeHref = items
    .filter((item) => isActive(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <SidebarGroup>
      <SidebarMenu className="gap-1">
        {items.map(({ href, label, icon: Icon }) => (
          <SidebarMenuItem key={href}>
            <SidebarMenuButton asChild isActive={href === activeHref} tooltip={label}>
              <Link href={href}>
                <Icon />
                <span>{label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

function CollapseButton() {
  const { toggleSidebar, state } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={state === "expanded" ? "Contraer menú" : "Expandir menú"}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-lilac hover:text-ink"
    >
      <PanelLeft className="size-5" />
    </button>
  );
}

function UserMenu({ viewer }: { viewer: Viewer }) {
  const signOut = useSignOut();
  const name = viewer.member.name || viewer.user.email;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <InitialsAvatar name={name} color={viewer.member.color} size="sm" />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-sm text-ink-soft">{viewer.org.name}</span>
              </span>
              <ChevronsUpDown className="ml-auto text-ink-soft" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-60">
            <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
              <span className="truncate text-base font-medium text-ink">{viewer.user.email}</span>
              <span className="text-sm text-ink-soft">{ROLE_LABELS[viewer.member.role]}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="min-h-11 text-base">
              <Link href="/configuracion/perfil">
                <UserRound className="size-5" strokeWidth={1.5} />
                Mi perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-11 text-base" onSelect={() => void signOut()}>
              <LogOut className="size-5" strokeWidth={1.5} />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
