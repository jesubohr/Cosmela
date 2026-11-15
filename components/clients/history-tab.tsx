import { EmptyState } from "@/components/shared/empty-state";

/**
 * Historial: the client's sessions timeline with photos.
 * Phase 2 (attention flow) replaces this body with the sessions list.
 */
export function HistoryTab() {
  return <EmptyState message="Aún no hay atenciones registradas. Cada atención que cierres aparecerá aquí con sus fotos." />;
}
