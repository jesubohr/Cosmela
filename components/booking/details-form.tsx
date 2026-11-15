"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PhoneInput } from "@/components/shared/phone-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isValidPhone } from "@/lib/format";

export type Details = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  note: string;
  authorized: boolean;
};

type Errors = Partial<Record<keyof Details, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(details: Details): Errors {
  const errors: Errors = {};
  if (!details.firstName.trim()) errors.firstName = "Escribe tu nombre.";
  if (!isValidPhone(details.phone)) errors.phone = "Escribe un WhatsApp de 10 dígitos.";
  if (!EMAIL.test(details.email.trim())) errors.email = "Escribe un correo válido, como nombre@correo.com.";
  if (!details.authorized) errors.authorized = "Marca la autorización para enviar tu solicitud.";
  return errors;
}

/** "Tus datos". `onSubmit` resolves to an error message to show, or null when it went through. */
export function DetailsForm({
  orgName,
  slug,
  onSubmit,
}: {
  orgName: string;
  slug: string;
  onSubmit: (details: Details) => Promise<string | null>;
}) {
  const [details, setDetails] = useState<Details>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    note: "",
    authorized: false,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function set<K extends keyof Details>(key: K, value: Details[K]) {
    setDetails((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = validate(details);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) {
      document.getElementById(`booking-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    setPending(true);
    const error = await onSubmit(details);
    setPending(false);
    setFormError(error);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="booking-firstName" label="Nombre" error={errors.firstName}>
          <Input
            id="booking-firstName"
            autoComplete="given-name"
            value={details.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            aria-invalid={!!errors.firstName}
            aria-describedby={errors.firstName ? "booking-firstName-error" : undefined}
          />
        </Field>
        <Field id="booking-lastName" label="Apellidos">
          <Input
            id="booking-lastName"
            autoComplete="family-name"
            value={details.lastName}
            onChange={(e) => set("lastName", e.target.value)}
          />
        </Field>
      </div>
      <Field id="booking-phone" label="WhatsApp" error={errors.phone}>
        <PhoneInput
          id="booking-phone"
          value={details.phone}
          onChange={(value) => set("phone", value)}
          aria-invalid={!!errors.phone}
          aria-describedby={errors.phone ? "booking-phone-error" : undefined}
        />
      </Field>
      <Field id="booking-email" label="Correo" help="Te enviaremos la confirmación y el recordatorio de tu cita." error={errors.email}>
        <Input
          id="booking-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={details.email}
          onChange={(e) => set("email", e.target.value)}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "booking-email-error" : "booking-email-help"}
        />
      </Field>
      <Field id="booking-note" label="Nota (opcional)">
        <Textarea
          id="booking-note"
          rows={3}
          maxLength={500}
          value={details.note}
          onChange={(e) => set("note", e.target.value)}
          className="min-h-20"
        />
      </Field>

      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <Checkbox
            id="booking-authorized"
            checked={details.authorized}
            onCheckedChange={(checked) => set("authorized", checked === true)}
            aria-invalid={!!errors.authorized}
            aria-describedby={errors.authorized ? "booking-authorized-error" : undefined}
            className="mt-0.5"
          />
          <Label htmlFor="booking-authorized" className="block text-base leading-normal font-normal">
            Autorizo el tratamiento de mis datos personales según la{" "}
            <Link
              href={`/reservar/${slug}/privacidad`}
              target="_blank"
              className="text-plum underline underline-offset-4 hover:text-plum-hover"
            >
              política de privacidad de {orgName}
            </Link>
            .
          </Label>
        </div>
        {errors.authorized && (
          <p id="booking-authorized-error" className="pl-8 text-sm text-rose">
            {errors.authorized}
          </p>
        )}
      </div>

      {formError && (
        <p role="alert" className="rounded-lg bg-rose-soft px-4 py-3 text-rose">
          {formError}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Enviando…" : "Enviar solicitud"}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  help,
  error,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-rose">
          {error}
        </p>
      ) : (
        help && (
          <p id={`${id}-help`} className="text-sm text-ink-soft">
            {help}
          </p>
        )
      )}
    </div>
  );
}
