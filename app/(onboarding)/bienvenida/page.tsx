import type { Metadata } from "next";

export const metadata: Metadata = { title: "Te damos la bienvenida" };

export default function TedamoslabienvenidaPage() {
  return (
    <main className="mx-auto w-full max-w-[720px] px-4 py-10 lg:px-8">
      <h1 className="font-display text-[1.75rem] leading-tight">Te damos la bienvenida</h1>
    </main>
  );
}
