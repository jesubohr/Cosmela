"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { SingleChoice } from "@/components/forms/choice-chips";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsSection } from "./settings-page";

type Theme = "system" | "light" | "dark";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "system", label: "Como el dispositivo" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
];

const noop = () => () => {};

/** Theme choice, stored on this device by next-themes. */
export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  // The saved theme is only known in the browser.
  const mounted = useSyncExternalStore(noop, () => true, () => false);

  return (
    <SettingsSection title="Apariencia" description="Se guarda en este dispositivo.">
      {mounted ? (
        <SingleChoice<Theme>
          label="Apariencia"
          options={OPTIONS}
          value={(theme as Theme | undefined) ?? "system"}
          onChange={(value) => value && setTheme(value)}
          required
        />
      ) : (
        <Skeleton className="h-11 w-80 max-w-full" />
      )}
    </SettingsSection>
  );
}
