import { formatDate, formatTime } from "@/lib/format";

/** WhatsApp text that confirms an appointment, in the professional's voice. */
export function confirmationMessage({
  clientName,
  treatmentName,
  start,
  memberName,
  orgName,
}: {
  clientName: string;
  treatmentName: string;
  start: number;
  memberName?: string;
  orgName: string;
}) {
  const firstName = clientName.split(" ")[0];
  const withWhom = memberName ? ` con ${memberName}` : "";
  return `Hola, ${firstName}. Te confirmo tu cita de ${treatmentName} el ${formatDate(start)} a las ${formatTime(start)}${withWhom} en ${orgName}. Si necesitas cambiarla, escríbeme por aquí.`;
}
