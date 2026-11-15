// Prepares local development from the owner's .env without printing secrets:
// 1. writes the public values Next.js needs into .env.local
// 2. creates the local anonymous Convex deployment (first run only)
// 3. sets the backend env vars on that local deployment
// It refuses to touch a cloud deployment.
// Usage: node scripts/setup-local.mjs
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SITE_URL = "http://localhost:3000";
const BACKEND_KEYS = ["RESEND_API_KEY", "RESEND_FROM", "R2_BUCKET", "R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_TOKEN"];

function parse(file) {
  if (!existsSync(file)) return {};
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function serialize(env) {
  return Object.entries(env).map(([key, value]) => `${key}=${value}`).join("\n") + "\n";
}

function convex(args, options = {}) {
  // CONVEX_DEPLOYMENT is blanked so the CLI never falls back to the cloud value in .env.
  const env = { ...process.env, CONVEX_AGENT_MODE: "anonymous" };
  if (!parse(".env.local").CONVEX_DEPLOYMENT) env.CONVEX_DEPLOYMENT = "";
  return execSync(["pnpm exec convex", ...args].join(" "), { env, encoding: "utf8", ...options });
}

const source = parse(".env");
const local = parse(".env.local");
writeFileSync(
  ".env.local",
  serialize({
    ...local,
    NEXT_PUBLIC_SITE_URL: local.NEXT_PUBLIC_SITE_URL ?? SITE_URL,
    NEXT_PUBLIC_POSTHOG_KEY: local.NEXT_PUBLIC_POSTHOG_KEY ?? source.POSTHOG_KEY ?? "",
    NEXT_PUBLIC_POSTHOG_HOST: local.NEXT_PUBLIC_POSTHOG_HOST ?? source.POSTHOG_HOST ?? "",
  }),
);

if (!parse(".env.local").CONVEX_DEPLOYMENT) {
  console.log("Creating the local anonymous Convex deployment…");
  convex(["dev", "--once", "--typecheck", "disable"], { stdio: "inherit" });
}

const deployment = parse(".env.local").CONVEX_DEPLOYMENT ?? "";
if (!/^(anonymous|local):/.test(deployment)) {
  console.error(`Refusing to set env vars: CONVEX_DEPLOYMENT in .env.local is not local (${deployment.split(":")[0]}).`);
  process.exit(1);
}

const backend = { SITE_URL };
for (const key of BACKEND_KEYS) if (source[key]) backend[key] = source[key];
let hasSecret = false;
try {
  hasSecret = convex(["env", "get", "BETTER_AUTH_SECRET"], { stdio: ["ignore", "pipe", "ignore"] }).trim().length > 0;
} catch {
  hasSecret = false;
}
if (!hasSecret) backend.BETTER_AUTH_SECRET = randomBytes(32).toString("base64");

const dir = mkdtempSync(join(tmpdir(), "cosmela-env-"));
const file = join(dir, "backend.env");
try {
  writeFileSync(file, serialize(backend));
  convex(["env", "set", "--force", "--from-file", JSON.stringify(file)], { stdio: ["ignore", "ignore", "pipe"] });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`Local Convex env set: ${Object.keys(backend).join(", ")}`);
