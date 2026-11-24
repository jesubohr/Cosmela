"use client";

import { useId, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Saved as the evidence text, so each one must keep the 5-character minimum of the server. */
const CHANNELS = ["En persona", "Formato en papel firmado", "Por WhatsApp", "Por correo electrónico", "Por llamada telefónica"];
const OTHER = "other";

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
  const [other, setOther] = useState(false);
  const channel = other ? OTHER : CHANNELS.includes(evidence) ? evidence : "";

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
        <Select
          value={channel}
          onValueChange={(value) => {
            setOther(value === OTHER);
            onEvidenceChange(value === OTHER ? "" : value);
          }}
        >
          <SelectTrigger id={`${id}-evidence`} className="w-full" aria-describedby={`${id}-evidence-hint`}>
            <SelectValue placeholder="Elige una opción" />
          </SelectTrigger>
          <SelectContent>
            {CHANNELS.map((value) => (
              <SelectItem key={value} value={value} className="min-h-11 text-base">
                {value}
              </SelectItem>
            ))}
            <SelectItem value={OTHER} className="min-h-11 text-base">
              Otro
            </SelectItem>
          </SelectContent>
        </Select>
        <p id={`${id}-evidence-hint`} className="max-w-[70ch] text-sm text-ink-soft">
          La ley de protección de datos te pide guardar prueba de la decisión del cliente. Queda en su ficha por si alguien la
          solicita.
        </p>
      </div>
      {other && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-other`} className="text-base">
            Describe cómo la recibiste
          </Label>
          <Input
            id={`${id}-other`}
            value={evidence}
            onChange={(e) => onEvidenceChange(e.target.value)}
            maxLength={500}
            autoComplete="off"
            autoFocus
          />
        </div>
      )}
      <div className="flex items-start gap-3">
        <Checkbox id={`${id}-adult`} checked={adult} onCheckedChange={(value) => onAdultChange(value === true)} className="mt-0.5 size-6" />
        <Label htmlFor={`${id}-adult`} className="text-base leading-normal font-normal">
          Confirmé que el cliente tiene 18 años o más.
        </Label>
      </div>
    </div>
  );
}
