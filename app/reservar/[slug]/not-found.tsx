import { BookingMessage, BookingShell } from "@/components/booking/parts";

export default function BookingNotFound() {
  return (
    <BookingShell>
      <BookingMessage title="No encontramos esta página" text="Revisa el enlace o pídele uno nuevo al negocio." />
    </BookingShell>
  );
}
