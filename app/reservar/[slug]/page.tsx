import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reserva tu cita" };

export default function ReservatucitaPage() {
  return (
    <main className="mx-auto w-full max-w-[720px] px-4 py-10 lg:px-8">
      <h1 className="font-display text-[1.75rem] leading-tight">Reserva tu cita</h1>
    </main>
  );
}
