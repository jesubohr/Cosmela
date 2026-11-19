"use client";

import SignaturePadLib from "signature_pad";
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SignaturePadHandle = {
  /** Trimmed PNG with a transparent background, or null when nothing was drawn. */
  toBlob: () => Promise<Blob | null>;
  clear: () => void;
  isEmpty: () => boolean;
};

export type SignaturePadProps = {
  /** Imperative handle: `ref.current.toBlob()`, `.clear()`, `.isEmpty()`. */
  ref?: Ref<SignaturePadHandle>;
  /** Called after each stroke and after "Borrar" with whether the pad is empty. */
  onChange?: (isEmpty: boolean) => void;
  /** Accessible name for the drawing area, e.g. "Firma de la clienta". */
  label: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Full-width signature canvas (200 px tall, 240 px from 768 px) for finger or mouse.
 * Upload the blob with `useUploadFile()` from `photo-upload.tsx`: `upload(blob, "signature")`.
 */
export function SignaturePad({ ref, onChange, label, disabled, className }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const pad = new SignaturePadLib(canvas, { penColor: "#2A2131", minWidth: 0.8, maxWidth: 2.4 });
    padRef.current = pad;
    const emit = () => onChangeRef.current?.(pad.isEmpty());
    pad.addEventListener("endStroke", emit);

    // Match the canvas bitmap to its CSS size and pixel ratio, keeping strokes on resize.
    let width = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === width) return;
      width = rect.width;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const data = pad.toData();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      canvas.getContext("2d")!.scale(ratio, ratio);
      pad.clear();
      pad.fromData(data);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    return () => {
      observer.disconnect();
      pad.removeEventListener("endStroke", emit);
      pad.off();
      padRef.current = null;
    };
  }, []);

  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    if (disabled) pad.off();
    else pad.on();
  }, [disabled]);

  useImperativeHandle(ref, () => ({
    toBlob: async () => {
      const canvas = canvasRef.current;
      const pad = padRef.current;
      if (!canvas || !pad || pad.isEmpty()) return null;
      return trimmedPng(canvas);
    },
    clear: () => {
      padRef.current?.clear();
      onChangeRef.current?.(true);
    },
    isEmpty: () => padRef.current?.isEmpty() ?? true,
  }));

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative h-[200px] overflow-hidden rounded-lg border border-field-line bg-surface md:h-[240px]">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={label}
          className={cn("signature-ink absolute inset-0 size-full touch-none", disabled && "opacity-60")}
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-6 bottom-12 border-b border-line" />
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          onClick={() => {
            padRef.current?.clear();
            onChangeRef.current?.(true);
          }}
        >
          Borrar
        </Button>
      </div>
    </div>
  );
}

/** Crops transparent margins (plus 8 px padding) and returns a PNG blob. */
async function trimmedPng(source: HTMLCanvasElement): Promise<Blob | null> {
  const context = source.getContext("2d")!;
  const { width, height } = source;
  const pixels = context.getImageData(0, 0, width, height).data;
  let top = height;
  let left = width;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] === 0) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) return null;

  const pad = 8;
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  const cropWidth = Math.min(width, right + pad) - left;
  const cropHeight = Math.min(height, bottom + pad) - top;
  const output = document.createElement("canvas");
  output.width = cropWidth;
  output.height = cropHeight;
  output.getContext("2d")!.drawImage(source, left, top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  return new Promise((resolve) => output.toBlob(resolve, "image/png"));
}
