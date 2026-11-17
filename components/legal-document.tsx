import { DocumentPage } from "@/components/booking/document";
import Link from "next/link";
import { CookiePreferencesLink } from "@/components/cookie-preferences";
import { LEGAL_DOCUMENTS } from "@/lib/legal-documents";

export function LegalDocument({ document }: { document: keyof typeof LEGAL_DOCUMENTS }) {
  const { title, content, version } = LEGAL_DOCUMENTS[document];
  return (
    <DocumentPage back={{ href: "/", label: "Cosmela", display: true }} title={title} meta={`Vigente desde el 16 de noviembre de 2026 · Versión ${version}`}>
      {content.split(/\n\s*\n/).map((block, index) => {
        if (block.startsWith("## ")) return <h2 key={index}>{block.slice(3)}</h2>;
        if (block.startsWith("- ")) return <ul key={index}>{block.split("\n").map((item, i) => <li key={i}>{item.replace(/^- /, "")}</li>)}</ul>;
        return <p key={index}>{block}</p>;
      })}
      <nav aria-label="Documentos legales" className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-5 text-sm">
        {Object.entries(LEGAL_DOCUMENTS).filter(([type]) => type !== document).map(([type, item]) => <Link key={type} href={item.href}>{item.title}</Link>)}
        <CookiePreferencesLink />
        <a href="mailto:ayuda@cosmela.app">ayuda@cosmela.app</a>
      </nav>
    </DocumentPage>
  );
}
