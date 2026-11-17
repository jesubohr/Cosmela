export function checkoutAuthorizationLabel(plan: "solo" | "salon", amount: number) {
  const price = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
  return `Elijo el plan ${plan === "solo" ? "Solo" : "Salón"} por ${price} COP al mes y autorizo su renovación mensual. Revisaré el total y los impuestos en Polar antes de pagar. He leído las condiciones de cancelación y reembolso.`;
}
