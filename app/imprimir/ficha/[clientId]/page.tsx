import type { Metadata } from "next";

export const metadata: Metadata = { title: "Ficha clínica" };

export default function FichaclinicaPage() {
  return (
    <main className="mx-auto w-full max-w-[720px] px-4 py-10 lg:px-8">
      <h1 className="font-display text-[1.75rem] leading-tight">Ficha clínica</h1>
    </main>
  );
}
