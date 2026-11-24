"use client";

import { useEffect, useState } from "react";

const PHRASES = [
  "Preparando todo para tu negocio…",
  "Organizando los estantes de tu cabina…",
  "Acomodando tus tratamientos…",
  "Doblando las toallas…",
  "Alistando las fichas de tus clientes…",
  "Abriendo tu agenda…",
];

/** Full-screen wait while the business is created, so a slow network never looks like a frozen app. */
export function CreatingSplash() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % PHRASES.length), 2400);
    return () => clearInterval(timer);
  }, []);

  return (
    <div role="status" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-porcelain px-6 text-center">
      <JarIcon />
      <div className="flex flex-col gap-2">
        <p className="font-display text-[1.75rem] leading-tight">Creando tu negocio</p>
        <p key={index} aria-hidden className="animate-in text-ink-soft duration-300 fade-in motion-reduce:animate-none">
          {PHRASES[index]}
        </p>
      </div>
    </div>
  );
}

/** A cream jar with three twinkling sparkles. */
function JarIcon() {
  const sparkle = "origin-center animate-[twinkle_1.8s_ease-in-out_infinite] [transform-box:fill-box] motion-reduce:animate-none";
  return (
    <svg aria-hidden viewBox="0 0 96 96" className="size-24 text-plum">
      <rect x="22" y="40" width="52" height="40" rx="10" className="fill-lilac" stroke="currentColor" strokeWidth="2.5" />
      <rect x="26" y="30" width="44" height="12" rx="4" fill="currentColor" />
      <path d="M34 58h28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path className={sparkle} d="M20 12l2.5 6.5L29 21l-6.5 2.5L20 30l-2.5-6.5L11 21l6.5-2.5z" fill="currentColor" />
      <path className={sparkle} style={{ animationDelay: "0.6s" }} d="M76 6l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="currentColor" />
      <path className={sparkle} style={{ animationDelay: "1.2s" }} d="M84 30l1.5 3.5L89 35l-3.5 1.5L84 40l-1.5-3.5L79 35l3.5-1.5z" fill="currentColor" />
    </svg>
  );
}
