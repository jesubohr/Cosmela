// Creates the "Solo" and "Practice" monthly products in the Polar SANDBOX (if missing),
// priced like production, and sets their ids on the local Convex backend:
// POLAR_PRODUCT_SOLO_ID and POLAR_PRODUCT_SALON_ID. Never touches production Polar.
// Usage: node scripts/polar-sandbox-products.mjs
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const API = "https://sandbox-api.polar.sh";

// Amounts in cents, as Polar stores them: COP 90.000 / 220.000, USD 24 / 58.
const PRODUCTS = [
  { env: "POLAR_PRODUCT_SOLO_ID", name: "Solo", cop: 9_000_000, usd: 2_400 },
  { env: "POLAR_PRODUCT_SALON_ID", name: "Practice", cop: 22_000_000, usd: 5_800 },
];

function parse(file) {
  if (!existsSync(file)) return {};
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const token = parse(".env").POLAR_SANDBOX_TOKEN;
if (!token) {
  console.error("POLAR_SANDBOX_TOKEN is not in .env. Create an organization access token at https://sandbox.polar.sh and add it.");
  process.exit(1);
}
const deployment = parse(".env.local").CONVEX_DEPLOYMENT ?? "";
if (!/^(anonymous|local):/.test(deployment)) {
  console.error("Refusing to continue: CONVEX_DEPLOYMENT in .env.local is not a local deployment. Run pnpm setup first.");
  process.exit(1);
}

async function polar(method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Polar-Version": "2026-10", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    console.error(`Polar sandbox ${method} ${path} answered ${response.status}.`);
    process.exit(1);
  }
  return response.json();
}

const { items } = await polar("GET", "/v1/products/?is_archived=false&limit=100");
const ids = {};
for (const product of PRODUCTS) {
  let found = items.find((p) => p.name === product.name && p.recurring_interval === "month");
  if (found) {
    console.log(`Found sandbox product "${product.name}" (${found.id}).`);
  } else {
    found = await polar("POST", "/v1/products/", {
      name: product.name,
      recurring_interval: "month",
      prices: [
        { amount_type: "fixed", price_currency: "cop", price_amount: product.cop },
        { amount_type: "fixed", price_currency: "usd", price_amount: product.usd },
      ],
    });
    console.log(`Created sandbox product "${product.name}" (${found.id}).`);
  }
  ids[product.env] = found.id;
}

const env = { ...process.env, CONVEX_AGENT_MODE: "anonymous", CONVEX_DEPLOYMENT: deployment };
for (const [key, value] of Object.entries(ids)) {
  execSync(`pnpm exec convex env set ${key} ${value}`, { env, stdio: ["ignore", "ignore", "inherit"] });
}
console.log(`Local Convex env set: ${Object.keys(ids).join(", ")}`);
