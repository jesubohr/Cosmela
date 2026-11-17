"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { styles } from "./styles";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  function toggle() {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    const animate =
      "startViewTransition" in document &&
      matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)")
        .matches;
    if (!animate) {
      setTheme(next);
      return;
    }
    document.startViewTransition(() => {
      // The transition snapshots the DOM when this callback returns, so the class must change now;
      // next-themes applies it in an effect, too late for the snapshot.
      const style = document.createElement("style");
      style.textContent = "*,*::before,*::after{transition:none!important}";
      document.head.append(style);
      document.documentElement.classList.toggle("dark", next === "dark");
      document.documentElement.style.colorScheme = next;
      setTheme(next);
      requestAnimationFrame(() => requestAnimationFrame(() => style.remove()));
    });
  }

  return (
    <button
      type="button"
      className={styles.themeToggle}
      onClick={toggle}
      aria-label="Cambiar entre modo claro y oscuro"
    >
      <Moon size={18} aria-hidden="true" className={styles.moon} />
      <Sun size={18} aria-hidden="true" className={styles.sun} />
    </button>
  );
}
