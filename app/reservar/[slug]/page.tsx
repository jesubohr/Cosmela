import { preloadedQueryResult, preloadQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BookingFlow } from "@/components/booking/booking-flow";
import { api } from "@/convex/_generated/api";

const preloadBookingPage = cache(async (slug: string) => {
  const preloaded = await preloadQuery(api.booking.page, { slug });
  const page = preloadedQueryResult(preloaded);
  if (!page) notFound();
  return { page, preloaded };
});

export async function generateMetadata({ params }: PageProps<"/reservar/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { page } = await preloadBookingPage(slug);
  return {
    title: `Reserva tu cita en ${page.name}`,
    description: page.enabled ? `Elige tratamiento, día y hora en ${page.name}.` : undefined,
    alternates: page.enabled ? { canonical: `/reservar/${encodeURIComponent(slug)}` } : undefined,
    robots: page.enabled ? undefined : { index: false, follow: true },
  };
}

export default async function BookingPage({ params }: PageProps<"/reservar/[slug]">) {
  const { slug } = await params;
  const { preloaded } = await preloadBookingPage(slug);
  return <BookingFlow slug={slug} preloaded={preloaded} />;
}
