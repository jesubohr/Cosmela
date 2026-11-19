"use client";

import { useState } from "react";
import { useSignedUrls } from "@/components/shared/use-signed-urls";
import type { PhotoKind } from "@/convex/lib/validators";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ComparablePhoto = { key: string; kind: PhotoKind; at: number; sessionNumber: number };

function caption(photo: ComparablePhoto) {
  return `Sesión ${photo.sessionNumber}, ${photo.kind === "before" ? "antes" : "después"}, ${formatShortDate(photo.at)}`;
}

/** "Comparar fotos": pick two photos of the case; side by side on desktop, a slider on phones. */
export function PhotoCompare({ photos }: { photos: ComparablePhoto[] }) {
  const [pair, setPair] = useState<[string, string]>([photos[0].key, photos[photos.length - 1].key]);
  const [slot, setSlot] = useState<0 | 1>(0);
  const [position, setPosition] = useState(50);
  const urls = useSignedUrls(photos.map((p) => p.key));
  const first = photos.find((p) => p.key === pair[0])!;
  const second = photos.find((p) => p.key === pair[1])!;

  function pick(key: string) {
    setPair((current) => (slot === 0 ? [key, current[1]] : [current[0], key]));
    setSlot(slot === 0 ? 1 : 0);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div role="group" aria-label="Foto que cambias" className="flex gap-2">
          {(["Foto 1", "Foto 2"] as const).map((label, index) => (
            <button
              key={label}
              type="button"
              aria-pressed={slot === index}
              onClick={() => setSlot(index as 0 | 1)}
              className={cn(
                "min-h-11 rounded-full px-4 font-medium transition-colors",
                slot === index ? "bg-lilac text-plum" : "text-ink-soft hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-sm text-ink-soft">Toca una foto para ponerla como {slot === 0 ? "foto 1" : "foto 2"}.</p>
        <p aria-live="polite" className="sr-only">
          Foto 1: {caption(first)}. Foto 2: {caption(second)}.
        </p>
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          {photos.map((photo) => {
            const index = pair.indexOf(photo.key);
            return (
              <li key={photo.key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => pick(photo.key)}
                  aria-label={index >= 0 ? `${caption(photo)}, foto ${index + 1}` : caption(photo)}
                  className={cn("relative block size-16 overflow-hidden rounded-lg bg-line", index >= 0 && "ring-2 ring-plum ring-offset-2 ring-offset-porcelain")}
                >
                  {urls[photo.key] && (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed R2 URL
                    <img src={urls[photo.key]} alt="" loading="lazy" className="size-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" />
                  )}
                  {index >= 0 && (
                    <span className="absolute bottom-0.5 left-0.5 rounded bg-plum px-1.5 text-sm leading-5 font-medium text-on-solid">{index + 1}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Desktop: side by side. */}
      <div className="hidden max-w-3xl gap-4 md:grid md:grid-cols-2">
        {[first, second].map((photo, index) => (
          <figure key={index} className="flex flex-col gap-2">
            <div className="aspect-[3/4] overflow-hidden rounded-xl bg-line">
              {urls[photo.key] && (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed R2 URL
                <img src={urls[photo.key]} alt={caption(photo)} className="size-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" />
              )}
            </div>
            <figcaption className="text-sm text-ink-soft">{caption(photo)}</figcaption>
          </figure>
        ))}
      </div>

      {/* Phone: one frame, drag to reveal photo 1 over photo 2. */}
      <div className="flex flex-col gap-2 md:hidden">
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-line">
          {urls[second.key] && (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed R2 URL
            <img src={urls[second.key]} alt={caption(second)} className="absolute inset-0 size-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" />
          )}
          {urls[first.key] && (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed R2 URL
            <img
              src={urls[first.key]}
              alt={caption(first)}
              className="absolute inset-0 size-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
              style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
            />
          )}
          <div aria-hidden className="absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${position}%` }} />
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          aria-label="Deslizar para comparar"
          className="h-11 w-full accent-plum"
        />
        <div className="flex justify-between gap-4 text-sm text-ink-soft">
          <span>1: {caption(first)}</span>
          <span className="text-right">2: {caption(second)}</span>
        </div>
      </div>
    </div>
  );
}
