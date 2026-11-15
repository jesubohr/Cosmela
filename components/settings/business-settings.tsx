"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { SingleChoice } from "@/components/forms/choice-chips";
import { errorMessage } from "@/components/forms/error-message";
import { PhoneInput } from "@/components/shared/phone-input";
import { PhotoUpload } from "@/components/shared/photo-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { ORG_KINDS, type OrgKind } from "@/convex/lib/validators";
import { ORG_KIND_LABELS } from "@/lib/constants";
import { isValidPhone } from "@/lib/format";
import { SettingsSection } from "./settings-page";

type Org = FunctionReturnType<typeof api.orgs.get>;

export function BusinessSettings() {
  const org = useQuery(api.orgs.get);
  if (!org) {
    return (
      <div aria-busy className="flex flex-col gap-4">
        <Skeleton className="h-24 w-24 rounded-card" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-10">
      <LogoSection logoKey={org.logoKey} />
      <BusinessForm key={org._id} org={org} />
    </div>
  );
}

function LogoSection({ logoKey }: { logoKey?: string }) {
  const attach = useMutation(api.files.attach);
  const url = useQuery(api.files.getUrl, logoKey ? { key: logoKey } : "skip");
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <SettingsSection title="Logo" description="Aparece en tu página de reservas.">
      <div className="flex items-center gap-4">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-card border border-line bg-surface">
          {preview || url ? (
            // eslint-disable-next-line @next/next/no-img-element -- local preview or short-lived signed R2 URL
            <img src={preview ?? url!} alt="Logo del negocio" className="size-full object-contain p-2" />
          ) : logoKey ? (
            <Skeleton className="size-16" />
          ) : (
            <span className="px-2 text-center text-sm text-ink-soft">Sin logo</span>
          )}
        </div>
        <PhotoUpload
          kind="logo"
          capture={false}
          label={logoKey ? "Cambiar logo" : "Subir logo"}
          onUploaded={async (key, blob) => {
            try {
              await attach({ key, target: { kind: "orgLogo" } });
              setPreview(URL.createObjectURL(blob));
              toast.success("Logo guardado");
            } catch (error) {
              toast.error(errorMessage(error));
            }
          }}
        />
      </div>
    </SettingsSection>
  );
}

function BusinessForm({ org }: { org: Org }) {
  const update = useMutation(api.orgs.update);
  const [name, setName] = useState(org.name);
  const [kind, setKind] = useState<OrgKind>(org.kind);
  const [city, setCity] = useState(org.city ?? "");
  const [address, setAddress] = useState(org.address ?? "");
  const [whatsapp, setWhatsapp] = useState(org.whatsapp ?? "");
  const [legalName, setLegalName] = useState(org.legalName ?? "");
  const [taxId, setTaxId] = useState(org.taxId ?? "");
  // null = use the generated default text.
  const [policy, setPolicy] = useState<string | null>(org.privacyPolicy ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = !name.trim()
      ? "Escribe el nombre de tu negocio."
      : whatsapp && !isValidPhone(whatsapp)
        ? "Escribe un WhatsApp de 10 dígitos."
        : null;
    setError(message);
    if (message) return;
    setSaving(true);
    try {
      await update({
        name,
        kind,
        city,
        address,
        whatsapp: whatsapp || undefined,
        legalName,
        taxId,
        privacyPolicy: policy ?? undefined,
      });
      toast.success("Negocio guardado");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-10">
      <SettingsSection title="Datos del negocio">
        <Field id="org-name" label="Nombre" value={name} onChange={setName} autoComplete="organization" />
        <div className="flex flex-col gap-2">
          <span id="org-kind" className="font-medium">
            ¿Cómo trabajas?
          </span>
          <SingleChoice
            labelledBy="org-kind"
            required
            options={ORG_KINDS.map((k) => ({ value: k, label: ORG_KIND_LABELS[k] }))}
            value={kind}
            onChange={(value) => value && setKind(value)}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="org-city" label="Ciudad" value={city} onChange={setCity} autoComplete="address-level2" />
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-whatsapp" className="text-base">
              WhatsApp
            </Label>
            <PhoneInput id="org-whatsapp" value={whatsapp} onChange={setWhatsapp} />
          </div>
        </div>
        <Field id="org-address" label="Dirección" value={address} onChange={setAddress} autoComplete="street-address" />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="org-legal-name" label="Razón social o nombre legal" value={legalName} onChange={setLegalName} />
          <Field id="org-tax-id" label="NIT o cédula" value={taxId} onChange={setTaxId} />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Política de tratamiento de datos"
        description="Tus clientes la aceptan al reservar y al firmar su primera autorización. Escribimos un texto con los datos de tu negocio; puedes ajustarlo."
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="org-policy" className="sr-only">
            Política de tratamiento de datos
          </Label>
          <Textarea
            id="org-policy"
            value={policy ?? org.defaultPrivacyPolicy}
            onChange={(e) => setPolicy(e.target.value)}
            className="max-h-[32rem] min-h-80 text-[0.9375rem] leading-relaxed"
            style={{ fieldSizing: "fixed" }}
          />
          {policy !== null && (
            <Button type="button" variant="link" className="h-11 self-start px-0" onClick={() => setPolicy(null)}>
              Usar texto sugerido
            </Button>
          )}
          {policy === null && (
            <p className="text-sm text-ink-soft">El texto sugerido se actualiza cuando cambias los datos del negocio.</p>
          )}
        </div>
      </SettingsSection>

      {error && (
        <p role="alert" className="text-rose">
          {error}
        </p>
      )}
      <Button type="submit" className="self-start" disabled={saving}>
        {saving ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-base">
        {label}
      </Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} />
    </div>
  );
}
