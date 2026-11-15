"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarOff, CalendarPlus, ClipboardPlus, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";

// Targets are owned by Phase 1B (agenda sheets read `?accion=`).
const ACTIONS = [
  { href: "/agenda?accion=nueva-cita", label: "Nueva cita", icon: CalendarPlus },
  { href: "/agenda?accion=atencion-sin-cita", label: "Atención sin cita", icon: ClipboardPlus },
  { href: "/clientes/nuevo", label: "Nuevo cliente", icon: UserPlus },
  { href: "/agenda?accion=bloquear", label: "Bloquear horario", icon: CalendarOff },
];

/** The global "+" of Hoy, Agenda, and Clientes: a bottom sheet on phones, a menu on desktop. */
export function QuickActions() {
  const isMobile = useIsMobile(1024);
  const [open, setOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        <Button size="icon" aria-label="Crear" onClick={() => setOpen(true)} className="rounded-full">
          <Plus strokeWidth={2} />
        </Button>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent aria-describedby={undefined}>
            <DrawerHeader>
              <DrawerTitle>Crear</DrawerTitle>
            </DrawerHeader>
            <ul className="flex flex-col px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {ACTIONS.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-14 items-center gap-3 rounded-lg px-3 text-base font-medium hover:bg-lilac"
                  >
                    <Icon className="size-5 text-plum" strokeWidth={1.75} />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Plus strokeWidth={2} />
          Crear
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {ACTIONS.map(({ href, label, icon: Icon }) => (
          <DropdownMenuItem key={href} asChild className="min-h-11 text-base">
            <Link href={href}>
              <Icon className="size-5 text-plum" strokeWidth={1.75} />
              {label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
