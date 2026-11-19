"use client";

import { useMutation, useQuery } from "convex/react";
import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { errorText } from "@/components/forms/error-message";
import { PhotoUpload } from "@/components/shared/photo-upload";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { PhotoKind } from "@/convex/lib/validators";
import { PHOTO_KIND_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useSignedUrls } from "@/components/shared/use-signed-urls";
import { AuthorizationInputs } from "@/components/clients/authorization-inputs";

type Photo = { key: string; kind: PhotoKind; at: number };

/** Square thumbnails of R2 photos. With `onDelete`, each one has a remove button. */
export function PhotoThumbs({
  photos,
  onDelete,
  onOpen,
  size = "md",
  className,
}: {
  photos: Photo[];
  onDelete?: (photo: Photo) => void;
  onOpen?: (photo: Photo) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const urls = useSignedUrls(photos.map((p) => p.key));
  if (photos.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {photos.map((photo, index) => {
        const url = urls[photo.key];
        const label = `Foto ${PHOTO_KIND_LABELS[photo.kind].toLowerCase()} ${index + 1}`;
        const image = url ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed R2 URLs
          <img src={url} alt={label} loading="lazy" className="size-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" />
        ) : null;
        return (
          <li
            key={photo.key}
            className={cn("relative overflow-hidden rounded-xl bg-line", size === "md" ? "size-24 sm:size-28" : "size-16")}
          >
            {onOpen ? (
              <button type="button" onClick={() => onOpen(photo)} className="size-full" aria-label={`Ver ${label.toLowerCase()}`}>
                {image}
              </button>
            ) : (
              image
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(photo)}
                aria-label={`Eliminar ${label.toLowerCase()}`}
                className="absolute top-1 right-1 flex size-9 items-center justify-center rounded-full bg-black/60 text-white transition-colors after:absolute after:-inset-1 hover:bg-black/80"
              >
                <X className="size-4" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Photos of one kind in a draft session: take a photo, see thumbnails, delete before closing. */
export function SessionPhotos({ sessionId, photos, kind }: { sessionId: Id<"sessions">; photos: Photo[]; kind: PhotoKind }) {
  const attach = useMutation(api.files.attach);
  const attention = useQuery(api.clientAuthorizations.photoSession, { sessionId });
  const record = useMutation(api.clientAuthorizations.record);
  const [evidence, setEvidence] = useState("");
  const [adult, setAdult] = useState(false);
  const remove = useMutation(api.sessions.deletePhoto);
  const [deleting, setDeleting] = useState<Photo | null>(null);
  const [pending, setPending] = useState(false);
  const own = photos.filter((p) => p.kind === kind);

  async function confirmDelete() {
    if (!deleting) return;
    setPending(true);
    try {
      await remove({ sessionId, key: deleting.key });
      toast.success("Foto eliminada");
      setDeleting(null);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <PhotoThumbs photos={own} onDelete={setDeleting} />
      {attention && !attention.allowed && (
        <div className="flex flex-col gap-4">
          <p className="max-w-[70ch]">{attention.label}</p>
          <AuthorizationInputs
            policy={attention.policy}
            evidenceLabel="Cómo recibiste la autorización"
            evidence={evidence}
            onEvidenceChange={setEvidence}
            adult={adult}
            onAdultChange={setAdult}
          />
          <Button
            type="button"
            className="self-start"
            onClick={() =>
              void record({
                clientId: attention.clientId,
                purpose: "record_photos",
                action: "accepted",
                policyHash: attention.policyHash,
                evidence,
                adult,
                requestKey: crypto.randomUUID(),
              }).catch((error) => toast.error(errorText(error)))
            }
          >
            Registrar autorización
          </Button>
        </div>
      )}
      {attention?.allowed && (
        <PhotoUpload
          sessionId={sessionId}
          label={own.length > 0 ? "Tomar otra foto" : "Tomar foto"}
          onUploaded={(key) =>
            void attach({ key, target: { kind: "sessionPhoto", sessionId, photoKind: kind } }).catch((error) =>
              toast.error(errorText(error)),
            )
          }
        />
      )}
      <ResponsiveDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="¿Eliminar esta foto?"
        description="Se borra de la atención y no se puede recuperar."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)} disabled={pending}>
              Volver
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={pending}>
              Eliminar foto
            </Button>
          </>
        }
      >
        <span />
      </ResponsiveDialog>
    </div>
  );
}
