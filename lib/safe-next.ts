const DEFAULT_NEXT = "/hoy";
// Stands in for the app origin where `window` does not exist (server render, tests).
const FALLBACK_ORIGIN = "https://cosmela.invalid";

/**
 * Turns an untrusted `?next=` value into a path on this origin, or "/hoy".
 * Keeps the query and hash, so deep links such as `/invitacion/<token>` survive sign-in.
 */
export function safeNext(next: string | null, origin = globalThis.location?.origin ?? FALLBACK_ORIGIN) {
  if (!next) return DEFAULT_NEXT;
  try {
    const base = new URL(origin);
    const url = new URL(next, base);
    if (url.origin !== base.origin) return DEFAULT_NEXT;
    const path = url.pathname + url.search + url.hash;
    // Normalization can turn "/.//host" into "//host"; the result must still resolve here.
    return new URL(path, base).origin === base.origin ? path : DEFAULT_NEXT;
  } catch {
    return DEFAULT_NEXT;
  }
}
