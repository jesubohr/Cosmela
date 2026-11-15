"use client";

import { Plus } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { Textarea } from "@/components/ui/textarea";
import { CONSENT_PLACEHOLDERS, type ConsentValues } from "@/data/treatment-templates";
import { formatCalendarDate, todayKey } from "@/lib/format";

/** Sample client data for the live preview. */
export function sampleConsentValues(treatmentName: string, businessName: string): ConsentValues {
  return {
    cliente: "Laura Gómez",
    documento: "cédula de ciudadanía 1.023.456.789",
    tratamiento: treatmentName || "tratamiento",
    negocio: businessName,
    fecha: formatCalendarDate(todayKey()),
  };
}

/** Consent text with placeholders replaced and highlighted. */
export function ConsentPreview({ text, values }: { text: string; values: ConsentValues }) {
  const parts: ReactNode[] = text.split(/(\{(?:cliente|documento|tratamiento|negocio|fecha)\})/g).map((part, index) => {
    const key = part.match(/^\{(\w+)\}$/)?.[1] as keyof ConsentValues | undefined;
    return key ? (
      <mark key={index} className="rounded bg-lilac px-0.5 text-plum">
        {values[key]}
      </mark>
    ) : (
      part
    );
  });
  return <div className="max-w-[70ch] whitespace-pre-line">{parts}</div>;
}

/** Consent text editor with placeholder chips that insert at the cursor, and a live preview. */
export function ConsentEditor({
  value,
  onChange,
  previewValues,
}: {
  value: string;
  onChange: (value: string) => void;
  previewValues: ConsentValues;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insert(token: string) {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <label htmlFor="consent-text" className="font-medium">
          Texto del consentimiento
        </label>
        <p id="consent-help" className="-mt-1 text-sm text-ink-soft">
          Toca un dato para insertarlo donde está el cursor. Se completa con los datos reales al firmar.
        </p>
        <div role="group" aria-label="Insertar dato" className="flex flex-wrap gap-2">
          {CONSENT_PLACEHOLDERS.map(({ token, label }) => (
            <button
              key={token}
              type="button"
              onClick={() => insert(token)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-base hover:bg-lilac"
            >
              <Plus aria-hidden className="size-4 text-plum" strokeWidth={2} />
              {label}
            </button>
          ))}
        </div>
        <Textarea
          ref={textareaRef}
          id="consent-text"
          aria-describedby="consent-help"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-96 leading-relaxed"
        />
      </div>
      <section aria-labelledby="consent-preview" className="flex flex-col gap-3 lg:sticky lg:top-24 lg:self-start">
        <h3 id="consent-preview" className="font-medium">
          Vista previa
        </h3>
        <div className="rounded-card border border-line bg-surface p-4 leading-relaxed lg:p-6">
          <ConsentPreview text={value} values={previewValues} />
        </div>
      </section>
    </div>
  );
}
