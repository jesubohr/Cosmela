import type { KeyboardEvent } from "react";

const STEPS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * Arrow keys move focus and selection between the `role="radio"` buttons of a group.
 * Pair it with a roving tabindex: only the checked radio (or the first, when none is) has tabIndex 0.
 */
export function handleRadioKeys(event: KeyboardEvent<HTMLElement>) {
  const step = STEPS[event.key];
  if (!step) return;
  const radios = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not(:disabled)')];
  const current = radios.indexOf(document.activeElement as HTMLElement);
  if (current === -1) return;
  event.preventDefault();
  const next = radios[(current + step + radios.length) % radios.length];
  next.focus();
  next.click();
}
