/** "Plan": v1 is a free beta, with no payment. */
export function PlanSettings() {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-5">
      <h2 className="text-lg font-medium">Beta gratuita</h2>
      <p className="max-w-[60ch] text-ink-soft">
        Todas las funciones están incluidas sin costo mientras dure la beta. Te avisaremos con tiempo antes de cualquier
        cambio.
      </p>
    </div>
  );
}
