// The few Polar REST calls billing needs (API version 2026-10), with plain fetch.
// The SDK pulls metering and Redis dependencies we do not use. See docs/BILLING.md.

const API_VERSION = "2026-10";

export type PolarSubscription = {
  id: string;
  status: string;
  product_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  modified_at: string | null;
  metadata: Record<string, unknown>;
  customer: { external_id?: string | null };
};

export type PolarProduct = {
  id: string;
  name: string;
  prices: { amount_type: string; price_currency?: string; price_amount?: number; is_archived: boolean }[];
};

export class PolarError extends Error {
  constructor(public status: number, path: string) {
    super(`Polar ${path} answered ${status}`);
  }
}

export function polarConfigured(): boolean {
  return Boolean(process.env.POLAR_ORGANIZATION_TOKEN);
}

function baseUrl() {
  return process.env.POLAR_SERVER === "production" ? "https://api.polar.sh" : "https://sandbox-api.polar.sh";
}

/** Calls the Polar API with the organization token. Errors carry only the status, never the body. */
export async function polarRequest<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const token = process.env.POLAR_ORGANIZATION_TOKEN;
  if (!token) throw new Error("POLAR_ORGANIZATION_TOKEN is not set");
  const response = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Polar-Version": API_VERSION, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new PolarError(response.status, path.split("?")[0]);
  return (await response.json()) as T;
}

/** Fixed COP price of a product in pesos (Polar stores cents). */
export function copPrice(product: PolarProduct): number | undefined {
  const price = product.prices.find((p) => !p.is_archived && p.amount_type === "fixed" && p.price_currency === "cop");
  return price?.price_amount === undefined ? undefined : price.price_amount / 100;
}

/** The org a subscription belongs to: the customer's external id, or the checkout metadata. */
export function orgIdOf(subscription: PolarSubscription): string | undefined {
  const fromMetadata = subscription.metadata?.orgId;
  return subscription.customer?.external_id ?? (typeof fromMetadata === "string" ? fromMetadata : undefined);
}

export function toSubscriptionRow(subscription: PolarSubscription) {
  return {
    polarId: subscription.id,
    productId: subscription.product_id,
    status: subscription.status,
    currentPeriodEnd: subscription.current_period_end ? Date.parse(subscription.current_period_end) : undefined,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    modifiedAt: Date.parse(subscription.modified_at ?? subscription.created_at),
  };
}

const TOLERANCE_SECONDS = 300;

function decodeBase64(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

/**
 * Standard Webhooks signature check, as Polar's SDK does it: HMAC-SHA256 of
 * "id.timestamp.body", keyed by the secret as text or, for `whsec_` secrets, its base64 bytes.
 */
export async function verifyWebhook(body: string, headers: Headers, secret: string, now = Date.now()): Promise<boolean> {
  const id = headers.get("webhook-id");
  const timestamp = Number(headers.get("webhook-timestamp"));
  const signatures = headers.get("webhook-signature");
  if (!secret || !id || !signatures || !Number.isFinite(timestamp)) return false;
  if (Math.abs(now / 1000 - timestamp) > TOLERANCE_SECONDS) return false;

  const keys: Uint8Array<ArrayBuffer>[] = [new TextEncoder().encode(secret)];
  const decoded = decodeBase64(secret.replace(/^whsec_/, ""));
  if (decoded && decoded.byteLength > 0) keys.push(decoded);
  const content = new TextEncoder().encode(`${id}.${Math.floor(timestamp)}.${body}`);

  for (const key of keys) {
    const hmac = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    for (const entry of signatures.split(" ")) {
      const [version, signature] = entry.split(",", 2);
      const bytes = version === "v1" && signature ? decodeBase64(signature) : null;
      if (bytes && (await crypto.subtle.verify("HMAC", hmac, bytes, content))) return true;
    }
  }
  return false;
}
