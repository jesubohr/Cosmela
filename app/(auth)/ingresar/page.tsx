import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default function IngresarPage() {
  return (
    <main className="flex min-h-dvh flex-col px-4 pt-safe">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-10 py-12 lg:justify-center lg:py-16">
        <p className="font-display text-[1.75rem] leading-none text-plum">Cosmela</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
