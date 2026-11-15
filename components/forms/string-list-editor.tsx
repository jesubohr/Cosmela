"use client";

import { X } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type StringListEditorProps = {
  legend: string;
  /** Line under the legend. */
  help?: string;
  items: string[];
  onChange: (items: string[]) => void;
  /** Placeholder of the add input, e.g. "Nueva opción". */
  placeholder: string;
  /** Accessible name of each row, e.g. "Opción" → "Opción 2". */
  itemLabel: string;
};

/** Editable list of short texts: edit inline, remove, and add with Enter or "Agregar". */
export function StringListEditor({ legend, help, items, onChange, placeholder, itemLabel }: StringListEditorProps) {
  const id = useId();
  const [draft, setDraft] = useState("");

  function addDraft() {
    const value = draft.trim();
    if (value && !items.includes(value)) onChange([...items, value]);
    setDraft("");
  }

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={help ? `${id}-help` : undefined}>
      <legend className="mb-1 font-medium">{legend}</legend>
      {help && (
        <p id={`${id}-help`} className="-mt-1 mb-1 max-w-[70ch] text-sm text-ink-soft">
          {help}
        </p>
      )}
      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item, index) => (
            <li key={index} className="flex items-start gap-2">
              {/* Grows with the text, so long items stay readable; items are single lines. */}
              <Textarea
                rows={1}
                aria-label={`${itemLabel} ${index + 1}`}
                value={item}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                onChange={(e) =>
                  onChange(items.map((current, i) => (i === index ? e.target.value.replace(/\n/g, " ") : current)))
                }
                className="min-h-11 resize-none py-2"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Quitar ${item || `${itemLabel.toLowerCase()} ${index + 1}`}`}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                <X strokeWidth={1.75} />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <Input
          aria-label={placeholder}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraft();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={addDraft} disabled={!draft.trim()}>
          Agregar
        </Button>
      </div>
    </fieldset>
  );
}
