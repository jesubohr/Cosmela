"use client";

import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import { SingleChips } from "@/components/clients/chips";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

export type AttentionData = FunctionReturnType<typeof api.sessions.attention>;
export type DraftData = AttentionData & { session: NonNullable<AttentionData["session"]> };

/** Props every step gets from the stepper. */
export type StepProps = {
  data: DraftData;
  onBack?: () => void;
  onDone: () => void;
  /** The stepper calls this when the user closes the flow, to keep what was typed. */
  registerDraft: (save: (() => Promise<unknown>) | null) => void;
};

export function StepBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-10 pb-8">{children}</div>;
}

export function StepSection({ title, description, children, className }: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-1">
        <h2 className="text-[1.125rem] font-medium">{title}</h2>
        {description && <p className="text-sm text-ink-soft">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Sticky footer: Atrás / main action (48 px). When the main action is disabled,
 * `blocked` says why, so a gate never looks broken.
 */
export function StepFooter({
  onBack,
  onContinue,
  label = "Continuar",
  pending,
  blocked,
  error,
  variant = "default",
}: {
  onBack?: () => void;
  onContinue: () => void;
  label?: string;
  pending?: boolean;
  blocked?: string | null;
  error?: string | null;
  variant?: "default" | "destructive";
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-auto border-t border-line bg-porcelain/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-porcelain/85">
      <div aria-live="polite" className="empty:hidden">
        {error ? (
          <p role="alert" className="mb-3 rounded-xl bg-rose-soft px-4 py-3 text-rose">
            {error}
          </p>
        ) : blocked ? (
          <p className="mb-3 text-sm text-ink-soft">{blocked}</p>
        ) : null}
      </div>
      <div className="flex gap-2">
        {onBack && (
          <Button variant="secondary" size="lg" onClick={onBack} disabled={pending} className="px-6">
            Atrás
          </Button>
        )}
        <Button size="lg" variant={variant} onClick={onContinue} disabled={pending || Boolean(blocked)} className="flex-1">
          {pending ? "Guardando…" : label}
        </Button>
      </div>
    </div>
  );
}

/** Sí / No chips for a required yes-or-no answer. */
export function YesNo({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <span className="text-base font-medium">{label}</span>
      <SingleChips
        label={label}
        options={[
          { value: true, label: "Sí" },
          { value: false, label: "No" },
        ]}
        value={value}
        onChange={(next) => next !== undefined && onChange(next)}
        required
        disabled={disabled}
      />
    </div>
  );
}
