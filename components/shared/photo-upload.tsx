"use client";

import { useMutation } from "convex/react";
import { Camera, ImagePlus } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type UploadKind = "photo" | "signature" | "logo";

/**
 * Uploads a blob to the private R2 bucket and resolves with its key
 * (`orgs/{orgId}/{kind}/{uuid}`). Store the key with a mutation afterwards,
 * e.g. `api.files.attach`. Use it directly for `SignaturePad` blobs.
 */
export function useUploadFile() {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  return useCallback(
    async (blob: Blob, kind: UploadKind, onProgress?: (fraction: number) => void) => {
      const { key, url } = await generateUploadUrl({ kind });
      await put(url, blob, onProgress);
      return key;
    },
    [generateUploadUrl],
  );
}

export type PhotoUploadProps = {
  /** Called with the R2 key and the compressed blob (handy for an instant preview). */
  onUploaded: (key: string, blob: Blob) => void;
  /** "photo" (JPEG, default) or "logo" (PNG, keeps transparency). */
  kind?: "photo" | "logo";
  /** Opens the camera directly on phones. Set false to let the user pick from the gallery. Default true. */
  capture?: boolean;
  /** Button label. Defaults to "Tomar foto" (or "Elegir imagen" without capture). */
  label?: string;
  disabled?: boolean;
  className?: string;
};

/** Button that captures or picks an image, compresses it (1600 px, JPEG 0.82), and uploads it with progress. */
export function PhotoUpload({ onUploaded, kind = "photo", capture = true, label, disabled, className }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadFile();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setProgress(0);
    try {
      const blob = await compressImage(file, kind === "logo" ? "image/png" : "image/jpeg");
      const key = await upload(blob, kind, setProgress);
      onUploaded(key, blob);
    } catch (err) {
      setError(err instanceof ImageError ? err.message : "No pudimos subir la imagen. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setProgress(null);
    }
  }

  const uploading = progress !== null;
  const Icon = capture ? Camera : ImagePlus;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={capture ? "environment" : undefined}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handleFile(file);
        }}
      />
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        className="self-start"
      >
        <Icon />
        {uploading ? "Subiendo…" : (label ?? (capture ? "Tomar foto" : "Elegir imagen"))}
      </Button>
      {uploading && (
        <div
          role="progressbar"
          aria-label="Subiendo imagen"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="h-1 w-full max-w-xs overflow-hidden rounded-full bg-line"
        >
          <div className="h-full bg-plum transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose">
          {error}
        </p>
      )}
    </div>
  );
}

class ImageError extends Error {}

const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.82;

/** Scales the longest side down to 1600 px and re-encodes. Respects EXIF orientation. */
export async function compressImage(file: Blob, type: "image/jpeg" | "image/png" = "image/jpeg"): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageError("No pudimos leer esta imagen. Prueba con una foto en formato JPG o PNG.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d")!;
  if (type === "image/jpeg") {
    // JPEG has no alpha; transparent pixels would turn black.
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, JPEG_QUALITY));
  if (!blob) throw new ImageError("No pudimos procesar esta imagen. Intenta con otra.");
  return blob;
}

/** PUT with upload progress (fetch has no upload progress events). */
function put(url: string, blob: Blob, onProgress?: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", blob.type || "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(blob);
  });
}
