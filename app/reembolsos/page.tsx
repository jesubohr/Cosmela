import { LegalDocument } from "@/components/legal-document";
import { LEGAL_DOCUMENTS } from "@/lib/legal-documents";

export const metadata = { title: LEGAL_DOCUMENTS.refunds.title };

export default function Page() {
  return <LegalDocument document="refunds" />;
}
