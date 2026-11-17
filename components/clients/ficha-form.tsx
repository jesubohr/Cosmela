"use client";

/**
 * FichaForm: the client's permanent ficha (PRODUCT §3.1), reused by the client
 * page, quick create, and the attention flow (Phase 2).
 *
 *   const [ficha, setFicha] = useState(() => fichaFromClient(client)); // or emptyFicha()
 *   const [errors, setErrors] = useState<FichaErrors>({});
 *   const saveFicha = useSaveFicha();
 *
 *   <FichaForm value={ficha} onChange={setFicha} errors={errors} sections={["health", "habits", "skin"]} />
 *
 *   const result = await saveFicha({ clientId, value: ficha });  // omit clientId to create
 *   if (result.ok) toast.success("Ficha guardada"); else setErrors(result.errors);
 *
 * Health questions are optional (Ley 1581 de 2012: sensitive data). Each health list
 * has an explicit "Ninguna", so an empty list without it means "not answered".
 */

import Link from "next/link";
import { useMutation } from "convex/react";
import { ConvexError, type Infer } from "convex/values";
import { Check } from "lucide-react";
import { useCallback, useId, useState, type ReactNode } from "react";
import { PhoneInput } from "@/components/shared/phone-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ClientDoc, ClientInput } from "@/convex/clients";
import {
  ALLERGIES,
  CONDITIONS,
  DOCUMENT_TYPES,
  EXFOLIANT_HABITS,
  FITZPATRICK_TYPES,
  SEXES,
  SKIN_CONDITIONS,
  SKIN_TYPES,
  SUNSCREEN_HABITS,
  type ClientHealth,
  type DocumentType,
  type Fitzpatrick,
  type Sex,
  vClientHabits,
  vClientSkin,
} from "@/convex/lib/validators";
import {
  ALLERGY_LABELS,
  CONDITION_LABELS,
  DOCUMENT_TYPE_LABELS,
  EXFOLIANT_LABELS,
  FITZPATRICK,
  SEX_LABELS,
  SKIN_CONDITION_LABELS,
  SKIN_TYPE_LABELS,
  SUNSCREEN_LABELS,
} from "@/lib/constants";
import { ageFromBirthDate, isValidPhone, todayKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MultiChipsWithNone, SingleChips } from "./chips";

export type ClientHabits = Infer<typeof vClientHabits>;
export type ClientSkin = Infer<typeof vClientSkin>;

/** Form state. Text fields use "" for empty. */
export type FichaValue = {
  firstName: string;
  lastName: string;
  phone: string;
  documentType: DocumentType | undefined;
  documentNumber: string;
  birthDate: string;
  sex: Sex | undefined;
  email: string;
  occupation: string;
  address: string;
  emergencyName: string;
  emergencyPhone: string;
  health: ClientHealth;
  habits: ClientHabits;
  skin: ClientSkin;
  notes: string;
};

export type FichaField = "firstName" | "phone" | "email" | "birthDate" | "emergencyPhone" | "form";
/** Messages by field; `form` is for errors that belong to no single field. */
export type FichaErrors = Partial<Record<FichaField, ReactNode>>;

/** identity: name and phone. general: the rest of "Datos generales". */
export const FICHA_SECTIONS = ["identity", "general", "health", "habits", "skin", "notes"] as const;
export type FichaSection = (typeof FICHA_SECTIONS)[number];

export function emptyFicha(): FichaValue {
  return {
    firstName: "",
    lastName: "",
    phone: "",
    documentType: undefined,
    documentNumber: "",
    birthDate: "",
    sex: undefined,
    email: "",
    occupation: "",
    address: "",
    emergencyName: "",
    emergencyPhone: "",
    health: { conditions: [], allergies: [], skinConditions: [], none: { conditions: false, allergies: false, skin: false } },
    habits: {},
    skin: {},
    notes: "",
  };
}

export function fichaFromClient(client: ClientDoc): FichaValue {
  return {
    firstName: client.firstName,
    lastName: client.lastName,
    phone: client.phone,
    documentType: client.documentType,
    documentNumber: client.documentNumber ?? "",
    birthDate: client.birthDate ?? "",
    sex: client.sex,
    email: client.email ?? "",
    occupation: client.occupation ?? "",
    address: client.address ?? "",
    emergencyName: client.emergencyContact?.name ?? "",
    emergencyPhone: client.emergencyContact?.phone ?? "",
    health: client.health,
    habits: client.habits,
    skin: client.skin,
    notes: client.notes ?? "",
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Client-side checks with the same rules as the server. */
export function validateFicha(value: FichaValue): FichaErrors {
  const errors: FichaErrors = {};
  if (!value.firstName.trim()) errors.firstName = "Escribe el nombre.";
  if (!isValidPhone(value.phone)) errors.phone = "Escribe un teléfono de 10 dígitos.";
  if (value.email.trim() && !EMAIL.test(value.email.trim())) errors.email = "Escribe un correo válido, como nombre@correo.com.";
  if (value.birthDate && value.birthDate > todayKey()) errors.birthDate = "La fecha de nacimiento no puede ser futura.";
  if (value.emergencyPhone && !isValidPhone(value.emergencyPhone)) {
    errors.emergencyPhone = "Escribe un teléfono de 10 dígitos.";
  }
  return errors;
}

/** Mutation input. Without `includeHealth`, health, habits, and skin stay as stored (quick create). */
export function toClientInput(value: FichaValue, { includeHealth = true } = {}): ClientInput {
  return {
    firstName: value.firstName,
    lastName: value.lastName,
    phone: value.phone,
    documentType: value.documentType,
    documentNumber: value.documentNumber,
    birthDate: value.birthDate,
    sex: value.sex,
    email: value.email,
    occupation: value.occupation,
    address: value.address,
    emergencyContact:
      value.emergencyName.trim() || value.emergencyPhone ? { name: value.emergencyName, phone: value.emergencyPhone } : undefined,
    notes: value.notes,
    ...(includeHealth ? { health: value.health, habits: value.habits, skin: value.skin } : {}),
  };
}

/** Drops the errors of fields the user just changed into a valid value. Other errors stay. */
export function withoutFixedErrors(errors: FichaErrors, previous: FichaValue, next: FichaValue): FichaErrors {
  const stillInvalid = validateFicha(next);
  const kept = { ...errors };
  for (const field of Object.keys(errors) as FichaField[]) {
    if (field !== "form" && next[field] !== previous[field] && !stillInvalid[field]) delete kept[field];
  }
  return kept;
}

export type SaveFichaResult = { ok: true; clientId: Id<"clients"> } | { ok: false; errors: FichaErrors };

/**
 * Validates and saves: updates `clientId`, or creates a client without it.
 * A duplicate phone comes back as `errors.phone` with a link to the existing client.
 */
export function useSaveFicha() {
  const create = useMutation(api.clients.create);
  const update = useMutation(api.clients.update);

  return useCallback(
    async ({
      clientId,
      value,
      includeHealth = true,
      authorization,
    }: {
      clientId?: Id<"clients">;
      value: FichaValue;
      includeHealth?: boolean;
      authorization?: { adult: boolean; evidence: string; policyHash: string; requestKey: string };
    }): Promise<SaveFichaResult> => {
      const errors = validateFicha(value);
      if (Object.keys(errors).length > 0) return { ok: false, errors };
      const client = toClientInput(value, { includeHealth });
      try {
        if (clientId) {
          await update({ clientId, client });
          return { ok: true, clientId };
        }
        return { ok: true, clientId: await create({ client, ...authorization }) };
      } catch (error) {
        return { ok: false, errors: fichaErrorsFrom(error) };
      }
    },
    [create, update],
  );
}

/** Maps a ConvexError from `clients.create`/`update` to field errors. */
export function fichaErrorsFrom(error: unknown): FichaErrors {
  if (!(error instanceof ConvexError)) return { form: "No pudimos guardar. Revisa tu conexión e intenta de nuevo." };
  const data = error.data as { code: string; message: string; clientId?: Id<"clients"> };
  if (data.code === "DUPLICATE_PHONE" && data.clientId) {
    return {
      phone: (
        <>
          {data.message}{" "}
          <Link href={`/clientes/${data.clientId}`} className="font-medium underline underline-offset-4">
            Abrir su ficha
          </Link>
        </>
      ),
    };
  }
  return { form: data.message };
}

export type FichaFormProps = {
  value: FichaValue;
  onChange: (value: FichaValue) => void;
  errors?: FichaErrors;
  /** Which parts to render, in this order. All by default. */
  sections?: readonly FichaSection[];
  disabled?: boolean;
  className?: string;
};

export function FichaForm({ value, onChange, errors = {}, sections = FICHA_SECTIONS, disabled, className }: FichaFormProps) {
  const set = <K extends keyof FichaValue>(key: K, next: FichaValue[K]) => onChange({ ...value, [key]: next });
  const show = (section: FichaSection) => sections.includes(section);

  return (
    <div className={cn("flex flex-col gap-10", className)}>
      {errors.form && (
        <p role="alert" className="rounded-xl bg-rose-soft px-4 py-3 text-rose">
          {errors.form}
        </p>
      )}
      {(show("identity") || show("general")) && (
        <Section title="Datos generales">
          {show("identity") && <IdentityFields value={value} set={set} errors={errors} disabled={disabled} />}
          {show("general") && <GeneralFields value={value} set={set} errors={errors} disabled={disabled} />}
        </Section>
      )}
      {show("health") && (
        <HealthFields health={value.health} onChange={(health) => set("health", health)} disabled={disabled} />
      )}
      {show("habits") && <HabitsFields habits={value.habits} onChange={(habits) => set("habits", habits)} disabled={disabled} />}
      {show("skin") && <SkinFields skin={value.skin} onChange={(skin) => set("skin", skin)} disabled={disabled} />}
      {show("notes") && (
        <Section title="Notas generales">
          <TextField
            label="Preferencias y notas"
            multiline
            placeholder="Prefiere música suave, sensible al frío…"
            value={value.notes}
            onChange={(notes) => set("notes", notes)}
            disabled={disabled}
          />
        </Section>
      )}
    </div>
  );
}

type Setter = <K extends keyof FichaValue>(key: K, next: FichaValue[K]) => void;
type FieldsProps = { value: FichaValue; set: Setter; errors: FichaErrors; disabled?: boolean };

function IdentityFields({ value, set, errors, disabled }: FieldsProps) {
  const phoneId = useId();
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <TextField
        label="Nombre(s)"
        value={value.firstName}
        onChange={(v) => set("firstName", v)}
        error={errors.firstName}
        autoComplete="off"
        disabled={disabled}
      />
      <TextField label="Apellidos" value={value.lastName} onChange={(v) => set("lastName", v)} autoComplete="off" disabled={disabled} />
      <div className="flex flex-col gap-2 md:col-span-2">
        <Label htmlFor={phoneId} className="text-base">
          Teléfono (WhatsApp)
        </Label>
        <PhoneInput
          id={phoneId}
          value={value.phone}
          onChange={(v) => set("phone", v)}
          aria-invalid={errors.phone ? true : undefined}
          disabled={disabled}
          className="md:max-w-xs"
        />
        <FieldError>{errors.phone}</FieldError>
      </div>
    </div>
  );
}

function GeneralFields({ value, set, errors, disabled }: FieldsProps) {
  const ids = { docType: useId(), birth: useId(), emergencyPhone: useId(), sex: useId() };
  const age = value.birthDate && value.birthDate <= todayKey() ? ageFromBirthDate(value.birthDate) : null;

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.docType} className="text-base">
          Documento
        </Label>
        <div className="flex gap-2">
          <Select
            value={value.documentType ?? ""}
            onValueChange={(v) => set("documentType", v as DocumentType)}
            disabled={disabled}
          >
            <SelectTrigger id={ids.docType} aria-label="Tipo de documento" className="w-28 shrink-0">
              <SelectValue placeholder="Tipo">{value.documentType}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_TYPES.map((type) => (
                <SelectItem key={type} value={type} className="min-h-11 text-base">
                  {DOCUMENT_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            aria-label="Número de documento"
            inputMode="numeric"
            autoComplete="off"
            value={value.documentNumber}
            onChange={(e) => set("documentNumber", e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.birth} className="text-base">
          Fecha de nacimiento
          {age !== null && <span className="font-normal text-ink-soft">{age === 1 ? "1 año" : `${age} años`}</span>}
        </Label>
        <Input
          id={ids.birth}
          type="date"
          max={todayKey()}
          value={value.birthDate}
          onChange={(e) => set("birthDate", e.target.value)}
          aria-invalid={errors.birthDate ? true : undefined}
          disabled={disabled}
        />
        <FieldError>{errors.birthDate}</FieldError>
      </div>
      <div className="flex flex-col gap-2 md:col-span-2">
        <span id={ids.sex} className="text-base font-medium">
          Sexo
        </span>
        <SingleChips
          labelledBy={ids.sex}
          options={SEXES.map((s) => ({ value: s, label: SEX_LABELS[s] }))}
          value={value.sex}
          onChange={(v) => set("sex", v)}
          disabled={disabled}
        />
      </div>
      <TextField
        label="Correo"
        type="email"
        inputMode="email"
        autoComplete="off"
        value={value.email}
        onChange={(v) => set("email", v)}
        error={errors.email}
        disabled={disabled}
      />
      <TextField label="Ocupación" value={value.occupation} onChange={(v) => set("occupation", v)} disabled={disabled} />
      <TextField label="Dirección" value={value.address} onChange={(v) => set("address", v)} className="md:col-span-2" disabled={disabled} />
      <TextField
        label="Contacto de emergencia"
        placeholder="Nombre"
        value={value.emergencyName}
        onChange={(v) => set("emergencyName", v)}
        disabled={disabled}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.emergencyPhone} className="text-base">
          Teléfono de emergencia
        </Label>
        <PhoneInput
          id={ids.emergencyPhone}
          value={value.emergencyPhone}
          onChange={(v) => set("emergencyPhone", v)}
          aria-invalid={errors.emergencyPhone ? true : undefined}
          disabled={disabled}
        />
        <FieldError>{errors.emergencyPhone}</FieldError>
      </div>
    </div>
  );
}

function HealthFields({
  health,
  onChange,
  disabled,
}: {
  health: ClientHealth;
  onChange: (health: ClientHealth) => void;
  disabled?: boolean;
}) {
  const ids = { conditions: useId(), allergies: useId(), skin: useId() };
  const [conditionsOtherOpen, setConditionsOtherOpen] = useState(Boolean(health.conditionsOther));
  const [skinOtherOpen, setSkinOtherOpen] = useState(Boolean(health.skinConditionsOther));
  const none = health.none;

  return (
    <>
      <Section title="Antecedentes de salud" description="Responder es opcional.">
        <div className="flex flex-col gap-3">
          <span id={ids.conditions} className="text-base font-medium">
            Enfermedades
          </span>
          <MultiChipsWithNone
            labelledBy={ids.conditions}
            options={[
              ...CONDITIONS.map((c) => ({ value: c as string, label: CONDITION_LABELS[c] })),
              { value: "other", label: "Otras" },
            ]}
            value={[...health.conditions, ...(conditionsOtherOpen ? ["other"] : [])]}
            none={none.conditions}
            onChange={(values, isNone) => {
              const other = values.includes("other");
              setConditionsOtherOpen(other);
              onChange({
                ...health,
                conditions: values.filter((v) => v !== "other") as ClientHealth["conditions"],
                conditionsOther: other ? health.conditionsOther : undefined,
                none: { ...none, conditions: isNone },
              });
            }}
            disabled={disabled}
          />
          {conditionsOtherOpen && (
            <TextField
              label="¿Cuáles?"
              value={health.conditionsOther ?? ""}
              onChange={(v) => onChange({ ...health, conditionsOther: v })}
              disabled={disabled}
            />
          )}
        </div>

        <div className="flex flex-col gap-3">
          <span id={ids.allergies} className="text-base font-medium">
            Alergias
          </span>
          <MultiChipsWithNone
            labelledBy={ids.allergies}
            options={ALLERGIES.map((a) => ({ value: a, label: ALLERGY_LABELS[a] }))}
            value={health.allergies}
            none={none.allergies}
            onChange={(allergies, isNone) =>
              onChange({
                ...health,
                allergies,
                allergiesDetail: allergies.length > 0 ? health.allergiesDetail : undefined,
                none: { ...none, allergies: isNone },
              })
            }
            disabled={disabled}
          />
          {health.allergies.length > 0 && (
            <TextField
              label="¿A qué?"
              placeholder="Penicilina, fragancias…"
              value={health.allergiesDetail ?? ""}
              onChange={(v) => onChange({ ...health, allergiesDetail: v })}
              disabled={disabled}
            />
          )}
        </div>
      </Section>

      <Section title="Historial dermatológico" description="Responder es opcional.">
        <div className="flex flex-col gap-3">
          <span id={ids.skin} className="text-base font-medium">
            Condiciones de la piel
          </span>
          <MultiChipsWithNone
            labelledBy={ids.skin}
            options={[
              ...SKIN_CONDITIONS.map((s) => ({ value: s as string, label: SKIN_CONDITION_LABELS[s] })),
              { value: "other", label: "Otras" },
            ]}
            value={[...health.skinConditions, ...(skinOtherOpen ? ["other"] : [])]}
            none={none.skin}
            onChange={(values, isNone) => {
              const other = values.includes("other");
              setSkinOtherOpen(other);
              onChange({
                ...health,
                skinConditions: values.filter((v) => v !== "other") as ClientHealth["skinConditions"],
                skinConditionsOther: other ? health.skinConditionsOther : undefined,
                none: { ...none, skin: isNone },
              });
            }}
            disabled={disabled}
          />
          {skinOtherOpen && (
            <TextField
              label="¿Cuáles?"
              value={health.skinConditionsOther ?? ""}
              onChange={(v) => onChange({ ...health, skinConditionsOther: v })}
              disabled={disabled}
            />
          )}
        </div>
        <TextField
          label="Observaciones"
          multiline
          value={health.dermNotes ?? ""}
          onChange={(v) => onChange({ ...health, dermNotes: v })}
          disabled={disabled}
        />
      </Section>
    </>
  );
}

function HabitsFields({
  habits,
  onChange,
  disabled,
}: {
  habits: ClientHabits;
  onChange: (habits: ClientHabits) => void;
  disabled?: boolean;
}) {
  const ids = { cleansing: useId(), sunscreen: useId(), exfoliants: useId() };
  return (
    <Section title="Hábitos de cuidado facial">
      <ChoiceRow id={ids.cleansing} label="Limpieza facial diaria">
        <SingleChips
          labelledBy={ids.cleansing}
          options={[
            { value: true, label: "Sí" },
            { value: false, label: "No" },
          ]}
          value={habits.dailyCleansing}
          onChange={(v) => onChange({ ...habits, dailyCleansing: v })}
          disabled={disabled}
        />
      </ChoiceRow>
      <ChoiceRow id={ids.sunscreen} label="Protector solar">
        <SingleChips
          labelledBy={ids.sunscreen}
          options={SUNSCREEN_HABITS.map((h) => ({ value: h, label: SUNSCREEN_LABELS[h] }))}
          value={habits.sunscreen}
          onChange={(v) => onChange({ ...habits, sunscreen: v })}
          disabled={disabled}
        />
      </ChoiceRow>
      <ChoiceRow id={ids.exfoliants} label="Exfoliantes">
        <SingleChips
          labelledBy={ids.exfoliants}
          options={EXFOLIANT_HABITS.map((h) => ({ value: h, label: EXFOLIANT_LABELS[h] }))}
          value={habits.exfoliants}
          onChange={(v) => onChange({ ...habits, exfoliants: v })}
          disabled={disabled}
        />
      </ChoiceRow>
      <TextField
        label="Tratamientos estéticos previos"
        multiline
        value={habits.previousTreatments ?? ""}
        onChange={(v) => onChange({ ...habits, previousTreatments: v })}
        disabled={disabled}
      />
    </Section>
  );
}

function SkinFields({ skin, onChange, disabled }: { skin: ClientSkin; onChange: (skin: ClientSkin) => void; disabled?: boolean }) {
  const ids = { type: useId(), fitzpatrick: useId() };
  return (
    <Section title="Piel">
      <ChoiceRow id={ids.type} label="Tipo de piel">
        <SingleChips
          labelledBy={ids.type}
          options={SKIN_TYPES.map((t) => ({ value: t, label: SKIN_TYPE_LABELS[t] }))}
          value={skin.type}
          onChange={(v) => onChange({ ...skin, type: v })}
          disabled={disabled}
        />
      </ChoiceRow>
      <ChoiceRow id={ids.fitzpatrick} label="Fototipo Fitzpatrick">
        <FitzpatrickPicker
          labelledBy={ids.fitzpatrick}
          value={skin.fitzpatrick}
          onChange={(v) => onChange({ ...skin, fitzpatrick: v })}
          disabled={disabled}
        />
      </ChoiceRow>
    </Section>
  );
}

/** Skin-tone swatches I–VI. Tapping the selected one clears it. */
export function FitzpatrickPicker({
  value,
  onChange,
  labelledBy,
  disabled,
}: {
  value: Fitzpatrick | undefined;
  onChange: (value: Fitzpatrick | undefined) => void;
  labelledBy?: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {FITZPATRICK_TYPES.map((type) => {
        const selected = value === type;
        const { label, swatch } = FITZPATRICK[type];
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`Fototipo ${label}`}
            disabled={disabled}
            onClick={() => onChange(selected ? undefined : type)}
            className={cn(
              "flex min-h-11 w-12 flex-col items-center gap-1 rounded-xl py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
              selected ? "bg-lilac text-plum" : "text-ink-soft hover:bg-porcelain",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-9 items-center justify-center rounded-full border border-ink/10",
                selected && "ring-2 ring-plum ring-offset-2 ring-offset-lilac",
              )}
              style={{ backgroundColor: swatch }}
            >
              {selected && <Check className={cn("size-4", type >= 4 ? "text-white" : "text-[#2a2131]")} strokeWidth={2.25} />}
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[1.125rem] font-medium">{title}</h2>
        {description && <p className="text-sm text-ink-soft">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function ChoiceRow({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <span id={id} className="text-base font-medium">
        {label}
      </span>
      {children}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  error,
  multiline,
  className,
  ...props
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: ReactNode;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
  type?: string;
  inputMode?: "email" | "text" | "numeric";
  autoComplete?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const common = {
    id,
    value,
    "aria-invalid": error ? true : undefined,
    placeholder: props.placeholder,
    disabled: props.disabled,
  };
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} className="text-base">
        {label}
      </Label>
      {multiline ? (
        <Textarea {...common} rows={3} className="min-h-20" onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input
          {...common}
          type={props.type ?? "text"}
          inputMode={props.inputMode}
          autoComplete={props.autoComplete}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <FieldError>{error}</FieldError>
    </div>
  );
}

function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-rose">
      {children}
    </p>
  );
}
