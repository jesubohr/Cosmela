import { fetchQuery, preloadQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { BookingFlow } from "@/components/booking/booking-flow";
import { api } from "@/convex/_generated/api";

export async function generateMetadata({ params }: PageProps<"/reservar/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchQuery(api.booking.page, { slug }).catch(() => null);
  return {
    title: page ? `Reserva tu cita en ${page.name}` : "Reserva tu cita",
    description: page ? `Elige tratamiento, día y hora en ${page.name}.` : undefined,
  };
}

export default async function BookingPage({ params }: PageProps<"/reservar/[slug]">) {
  const { slug } = await params;
  const preloaded = await preloadQuery(api.booking.page, { slug });
  return <BookingFlow slug={slug} preloaded={preloaded} />;
}
