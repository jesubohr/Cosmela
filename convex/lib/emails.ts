import { format } from "date-fns";
import { es } from "date-fns/locale";
import { inBogota } from "./time";

// Spanish email templates (PRODUCT §7). Each builder returns the subject, the HTML,
// and a plain-text alternative made from the same parts. Subjects never carry
// health data; only the aftercare email has care details in its body.

export type Email = { subject: string; html: string; text: string };

type Detail = { label: string; value: string };

type Parts = {
  orgName: string;
  paragraphs: string[];
  details?: Detail[];
  list?: string[];
  /** Shown after the list, e.g. the professional's notes. */
  closing?: string[];
  action?: { label: string; url: string };
  footer: string;
};

/** Epoch ms → "sábado 15 de noviembre" (Bogotá). */
export function emailDate(ms: number): string {
  return format(inBogota(ms), "EEEE d 'de' MMMM", { locale: es });
}

/** Epoch ms → "10:30 a. m." (Bogotá). */
export function emailTime(ms: number): string {
  const date = inBogota(ms);
  const hours = date.getHours();
  return `${hours % 12 || 12}:${format(date, "mm")} ${hours < 12 ? "a. m." : "p. m."}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

const INK = "#2A2131";
const INK_SOFT = "#6B6273";
const LINE = "#E6E0EB";
const PLUM = "#5B2A86";

function render(subject: string, parts: Parts): Email {
  const p = (text: string) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5">${escapeHtml(text)}</p>`;
  const details = parts.details?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 24px;border-top:1px solid ${LINE}">${parts.details
        .map(
          (d) =>
            `<tr><td style="padding:12px 0;border-bottom:1px solid ${LINE};font-size:14px;color:${INK_SOFT};width:38%;vertical-align:top">${escapeHtml(d.label)}</td><td style="padding:12px 0;border-bottom:1px solid ${LINE};font-size:16px;line-height:1.4">${escapeHtml(d.value)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const list = parts.list?.length
    ? `<ul style="margin:0 0 24px;padding-left:20px">${parts.list
        .map((item) => `<li style="margin:0 0 8px;font-size:16px;line-height:1.5">${escapeHtml(item)}</li>`)
        .join("")}</ul>`
    : "";
  const action = parts.action
    ? `<p style="margin:8px 0 24px"><a href="${escapeHtml(parts.action.url)}" style="display:inline-block;background:${PLUM};color:#FFFFFF;text-decoration:none;font-size:16px;font-weight:bold;padding:12px 20px;border-radius:10px">${escapeHtml(parts.action.label)}</a></p>`
    : "";

  const html = `<!doctype html>
<html lang="es-CO">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
  <body style="margin:0;padding:32px 16px;background:#F6F4F8;font-family:Arial,Helvetica,sans-serif;color:${INK}">
    <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid ${LINE};border-radius:14px;padding:32px 28px">
      <p style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.2;color:${PLUM}">${escapeHtml(parts.orgName)}</p>
      ${parts.paragraphs.map(p).join("")}${details}${list}${(parts.closing ?? []).map(p).join("")}${action}
      <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid ${LINE};font-size:14px;line-height:1.5;color:${INK_SOFT}">${escapeHtml(parts.footer)}</p>
    </div>
  </body>
</html>`;

  const text = [
    parts.orgName,
    ...parts.paragraphs,
    ...(parts.details ?? []).map((d) => `${d.label}: ${d.value}`),
    ...(parts.list ?? []).map((item) => `- ${item}`),
    ...(parts.closing ?? []),
    parts.action ? `${parts.action.label}: ${parts.action.url}` : "",
    parts.footer,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { subject, html, text };
}

const sentBy = (orgName: string) => `Este correo lo envía ${orgName} a través de Cosmela.`;

export type AppointmentInfo = {
  orgName: string;
  clientFirstName: string;
  treatmentName: string;
  start: number;
  /** Salons only: the professional who attends. */
  memberName?: string;
  /** "Calle 10 # 5-20, Medellín". */
  address?: string;
  /** `wa.me` link with a prefilled message to the business. */
  whatsappUrl?: string;
};

function appointmentDetails(info: AppointmentInfo): Detail[] {
  return [
    { label: "Tratamiento", value: info.treatmentName },
    { label: "Fecha", value: emailDate(info.start) },
    { label: "Hora", value: emailTime(info.start) },
    ...(info.memberName ? [{ label: "Te atiende", value: info.memberName }] : []),
    ...(info.address ? [{ label: "Dirección", value: info.address }] : []),
  ];
}

export function newRequestEmail(info: {
  orgName: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  treatmentName: string;
  start: number;
  memberName?: string;
  url: string;
}): Email {
  return render(`Nueva solicitud de cita de ${info.clientName}`, {
    orgName: info.orgName,
    paragraphs: [`${info.clientName} pidió una cita en tu página de reservas.`],
    details: [
      { label: "Tratamiento", value: info.treatmentName },
      { label: "Fecha", value: emailDate(info.start) },
      { label: "Hora", value: emailTime(info.start) },
      ...(info.memberName ? [{ label: "Profesional", value: info.memberName }] : []),
      { label: "WhatsApp", value: info.clientPhone },
      { label: "Correo", value: info.clientEmail },
    ],
    closing: ["El horario queda apartado hasta que confirmes o rechaces la solicitud."],
    action: { label: "Revisar solicitud", url: info.url },
    footer: "Recibes este correo porque haces parte del equipo de este negocio en Cosmela.",
  });
}

export function appointmentConfirmedEmail(info: AppointmentInfo): Email {
  return render(`Tu cita en ${info.orgName} está confirmada`, {
    orgName: info.orgName,
    paragraphs: [`Hola, ${info.clientFirstName}. Tu cita está confirmada.`],
    details: appointmentDetails(info),
    closing: ["Si no puedes asistir, avísanos con tiempo para darle el espacio a otra persona."],
    action: info.whatsappUrl ? { label: "Escribir por WhatsApp", url: info.whatsappUrl } : undefined,
    footer: sentBy(info.orgName),
  });
}

export function requestRejectedEmail(info: {
  orgName: string;
  clientFirstName: string;
  treatmentName: string;
  start: number;
  reason?: string;
  bookingUrl?: string;
}): Email {
  return render(`Sobre tu solicitud de cita en ${info.orgName}`, {
    orgName: info.orgName,
    paragraphs: [
      `Hola, ${info.clientFirstName}. ${info.orgName} no puede atender tu solicitud de ${info.treatmentName} a las ${emailTime(info.start)} del ${emailDate(info.start)}.`,
      ...(info.reason ? [`Motivo: ${info.reason}`] : []),
      ...(info.bookingUrl ? ["Puedes elegir otro horario en su página de reservas."] : []),
    ],
    action: info.bookingUrl ? { label: "Elegir otro horario", url: info.bookingUrl } : undefined,
    footer: sentBy(info.orgName),
  });
}

export function reminderEmail(info: AppointmentInfo): Email {
  return render(`Recordatorio de tu cita en ${info.orgName}`, {
    orgName: info.orgName,
    paragraphs: [`Hola, ${info.clientFirstName}. Te esperamos para tu cita.`],
    details: appointmentDetails(info),
    closing: info.whatsappUrl ? ["Si necesitas cambiar la hora, escríbenos por WhatsApp."] : [],
    action: info.whatsappUrl ? { label: "Reprogramar por WhatsApp", url: info.whatsappUrl } : undefined,
    footer: sentBy(info.orgName),
  });
}

export function aftercareEmail(info: {
  orgName: string;
  clientFirstName: string;
  treatmentName: string;
  date: number;
  items: string[];
  notes?: string;
  whatsappUrl?: string;
}): Email {
  return render(`Tus indicaciones de cuidado de ${info.orgName}`, {
    orgName: info.orgName,
    paragraphs: [
      `Hola, ${info.clientFirstName}. Estas son las indicaciones para después de tu ${info.treatmentName} del ${emailDate(info.date)}.`,
    ],
    list: info.items,
    closing: info.notes ? [info.notes] : [],
    action: info.whatsappUrl ? { label: "Escribir por WhatsApp", url: info.whatsappUrl } : undefined,
    footer: sentBy(info.orgName),
  });
}

/** Cosmela to the admins of a business whose trial ends in `daysLeft` days. */
export function trialEndingEmail(info: { orgName: string; daysLeft: number; endsAt: number; url: string }): Email {
  const when = info.daysLeft === 1 ? "mañana" : `en ${info.daysLeft} días`;
  return render(`Tu prueba de Cosmela termina ${when}`, {
    orgName: "Cosmela",
    paragraphs: [
      `La prueba gratis de ${info.orgName} termina el ${emailDate(info.endsAt)}.`,
      "Elige un plan para seguir creando citas y fichas. Tus datos se conservan y puedes consultarlos siempre.",
    ],
    action: { label: "Ver planes", url: info.url },
    footer: "Recibes este correo porque administras este negocio en Cosmela.",
  });
}
