"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CalendarOff, CalendarPlus, ClipboardPlus, Plus, UserPlus, type LucideIcon } from "lucide-react";
import { useAgendaSheets, type Sheet } from "@/components/agenda/agenda-sheets";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { todayKey } from "@/lib/format";

type Action = { label: string; icon: LucideIcon } & ({ sheet: () => Sheet } | { href: string });

// Sheets open over the current page, so cancelling leaves the user where they were.
const ACTIONS: Action[] = [
  { label: "Nueva cita", icon: CalendarPlus, sheet: () => ({ kind: "create", prefill: { date: todayKey() } }) },
  { label: "Atención sin cita", icon: ClipboardPlus, sheet: () => ({ kind: "walkIn" }) },
  { label: "Nuevo cliente", icon: UserPlus, href: "/clientes/nuevo" },
  { label: "Bloquear horario", icon: CalendarOff, sheet: () => ({ kind: "block", prefill: { date: todayKey() } }) },
];

/** The global "+" of Hoy, Agenda, and Clientes: a bottom sheet on phones, a menu on desktop. */
export function QuickActions() {
  const isMobile = useIsMobile(1024);
  const router = useRouter();
  const openSheet = useAgendaSheets();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function run(action: Action) {
    if ("href" in action) router.push(action.href);
    else openSheet(action.sheet(), triggerRef.current);
  }

  if (isMobile) {
    return (
      <>
        <Button ref={triggerRef} size="icon" aria-label="Crear" onClick={() => setOpen(true)} className="rounded-full">
          <Plus />
        </Button>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent aria-describedby={undefined}>
            <DrawerHeader>
              <DrawerTitle>Crear</DrawerTitle>
            </DrawerHeader>
            <ul className="flex flex-col px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {ACTIONS.map((action) => (
                <li key={action.label}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      run(action);
                    }}
                    className="flex min-h-14 w-full items-center gap-3 rounded-lg px-3 text-left text-base font-medium hover:bg-lilac"
                  >
                    <action.icon className="size-5 text-plum" />
                    {action.label}
                  </button>
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
        <Button ref={triggerRef}>
          <Plus />
          Crear
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {ACTIONS.map((action) => (
          <DropdownMenuItem key={action.label} className="min-h-11 text-base" onSelect={() => run(action)}>
            <action.icon className="size-5 text-plum" strokeWidth={1.5} />
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
