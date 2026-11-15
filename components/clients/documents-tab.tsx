import { EmptyState } from "@/components/shared/empty-state";
import type { ClientDoc } from "@/convex/clients";
import { AUTHORIZATION_METHOD_LABELS } from "@/lib/constants";
import { formatShortDate } from "@/lib/format";

/**
 * Documentos: signed consents and the data authorization.
 * Phase 2 adds the consents (viewable and printable) when sessions exist.
 */
export function DocumentsTab({ client }: { client: ClientDoc }) {
  const authorization = client.dataAuthorization;
  if (!authorization) {
    return <EmptyState message="Los consentimientos firmados y la autorización de datos aparecerán aquí después de la primera atención." />;
  }
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
      <li className="flex min-h-16 flex-col justify-center px-4 py-2.5">
        <span className="font-medium">Autorización de tratamiento de datos</span>
        <span className="text-sm text-ink-soft">
          {formatShortDate(authorization.at)}, {AUTHORIZATION_METHOD_LABELS[authorization.method].toLowerCase()}
        </span>
      </li>
    </ul>
  );
}
