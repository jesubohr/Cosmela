import type { ReactNode } from "react";
import type { ClientDoc } from "@/convex/clients";
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
import { ageFromBirthDate, formatCalendarDate, formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Read-only permanent ficha, grouped like `FichaForm`. Pass `sections` to show only some. */
export function FichaSummary({
  client,
  sections = ["general", "health", "habits", "skin", "notes"],
}: {
  client: ClientDoc;
  sections?: ("general" | "health" | "habits" | "skin" | "notes")[];
}) {
  const { health, habits, skin } = client;
  const show = (section: (typeof sections)[number]) => sections.includes(section);

  return (
    <div className="flex flex-col gap-8">
      {show("general") && (
        <Group title="Datos generales">
          <Row label="Teléfono">{formatPhone(client.phone)}</Row>
          <Row label="Documento">
            {client.documentNumber
              ? `${client.documentType ? `${DOCUMENT_TYPE_LABELS[client.documentType]} ` : ""}${client.documentNumber}`
              : null}
          </Row>
          <Row label="Fecha de nacimiento">
            {client.birthDate
              ? `${formatCalendarDate(client.birthDate)} (${ageFromBirthDate(client.birthDate)} años)`
              : null}
          </Row>
          <Row label="Sexo">{client.sex ? SEX_LABELS[client.sex] : null}</Row>
          <Row label="Correo">{client.email}</Row>
          <Row label="Ocupación">{client.occupation}</Row>
          <Row label="Dirección">{client.address}</Row>
          <Row label="Contacto de emergencia">
            {client.emergencyContact
              ? [client.emergencyContact.name, client.emergencyContact.phone && formatPhone(client.emergencyContact.phone)]
                  .filter(Boolean)
                  .join(", ")
              : null}
          </Row>
        </Group>
      )}

      {show("health") && (
        <Group title="Salud">
          <Row label="Enfermedades">
            {answer(
              health.none.conditions,
              [...health.conditions.map((c) => CONDITION_LABELS[c]), health.conditionsOther].filter(Boolean) as string[],
            )}
          </Row>
          <Row label="Alergias" tone={health.allergies.length > 0 ? "rose" : undefined}>
            {answer(
              health.none.allergies,
              health.allergies.map((a) => ALLERGY_LABELS[a]),
              health.allergiesDetail,
            )}
          </Row>
          <Row label="Condiciones de la piel">
            {answer(
              health.none.skin,
              [...health.skinConditions.map((s) => SKIN_CONDITION_LABELS[s]), health.skinConditionsOther].filter(
                Boolean,
              ) as string[],
            )}
          </Row>
          <Row label="Observaciones">{health.dermNotes}</Row>
        </Group>
      )}

      {show("habits") && (
        <Group title="Hábitos de cuidado facial">
          <Row label="Limpieza facial diaria">
            {habits.dailyCleansing === undefined ? null : habits.dailyCleansing ? "Sí" : "No"}
          </Row>
          <Row label="Protector solar">{habits.sunscreen ? SUNSCREEN_LABELS[habits.sunscreen] : null}</Row>
          <Row label="Exfoliantes">{habits.exfoliants ? EXFOLIANT_LABELS[habits.exfoliants] : null}</Row>
          <Row label="Tratamientos previos">{habits.previousTreatments}</Row>
        </Group>
      )}

      {show("skin") && (
        <Group title="Piel">
          <Row label="Tipo de piel">{skin.type ? SKIN_TYPE_LABELS[skin.type] : null}</Row>
          <Row label="Fototipo">
            {skin.fitzpatrick ? (
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-5 rounded-full outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
                  style={{ backgroundColor: FITZPATRICK[skin.fitzpatrick].swatch }}
                />
                {FITZPATRICK[skin.fitzpatrick].label}
              </span>
            ) : null}
          </Row>
        </Group>
      )}

      {show("notes") && (
        <Group title="Notas generales">
          <Row label="Notas">{client.notes}</Row>
        </Group>
      )}
    </div>
  );
}

/** "Ninguna", the list plus detail, or nothing (not answered). */
function answer(none: boolean, items: string[], detail?: string) {
  if (none) return "Ninguna";
  if (items.length === 0) return null;
  return detail ? `${items.join(", ")}: ${detail}` : items.join(", ");
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[1.125rem] font-medium">{title}</h2>
      <dl className="divide-y divide-line rounded-xl border border-line bg-surface">{children}</dl>
    </section>
  );
}

function Row({ label, children, tone }: { label: string; children: ReactNode; tone?: "rose" }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:gap-4">
      <dt className="text-sm text-ink-soft sm:w-52 sm:shrink-0 sm:pt-0.5">{label}</dt>
      <dd className={cn("min-w-0 [overflow-wrap:anywhere]", empty && "text-ink-soft", tone === "rose" && !empty && "font-medium text-rose")}>
        {empty ? "Sin dato" : children}
      </dd>
    </div>
  );
}
