"use client";

import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Policy text, how the client's decision was received, and the adult confirmation. The caller owns the state. */
export function AuthorizationInputs({
  policy,
  evidenceLabel,
  evidence,
  onEvidenceChange,
  adult,
  onAdultChange,
}: {
  policy: string;
  evidenceLabel: string;
  evidence: string;
  onEvidenceChange: (value: string) => void;
  adult: boolean;
  onAdultChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-4">
      <details>
        <summary className="cursor-pointer py-2.5 font-medium text-plum">Leer la política del negocio</summary>
        <p className="max-w-[70ch] pt-1 text-sm whitespace-pre-line text-ink-soft">{policy}</p>
      </details>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-evidence`} className="text-base">
          {evidenceLabel}
        </Label>
        <Input id={`${id}-evidence`} value={evidence} onChange={(e) => onEvidenceChange(e.target.value)} autoComplete="off" />
      </div>
      <div className="flex items-start gap-3">
        <Checkbox id={`${id}-adult`} checked={adult} onCheckedChange={(value) => onAdultChange(value === true)} className="mt-0.5 size-6" />
        <Label htmlFor={`${id}-adult`} className="text-base leading-normal font-normal">
          Confirmé que el cliente tiene 18 años o más.
        </Label>
      </div>
    </div>
  );
}
