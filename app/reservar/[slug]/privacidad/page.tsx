import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentPage, PolicyText, policyBlocks } from "@/components/booking/document";
import { api } from "@/convex/_generated/api";

export const metadata: Metadata = { title: "Política de privacidad", robots: { index: false, follow: true } };

export default async function BusinessPrivacyPage({ params }: PageProps<"/reservar/[slug]/privacidad">) {
  const { slug } = await params;
  const privacy = await fetchQuery(api.booking.privacy, { slug });

  if (!privacy) notFound();

  const blocks = policyBlocks(privacy.policy);
  // The generated policy starts with its own title line.
  const hasTitle = blocks[0]?.length === 1 && !/^\d+\./.test(blocks[0][0]);
  return (
    <DocumentPage
      back={{ href: `/reservar/${slug}`, label: `Volver a ${privacy.name}` }}
      title={hasTitle ? blocks[0][0] : `Política de privacidad de ${privacy.name}`}
    >
      <PolicyText blocks={hasTitle ? blocks.slice(1) : blocks} />
    </DocumentPage>
  );
}
