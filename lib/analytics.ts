import posthog from "posthog-js";

// PostHog is initialized in instrumentation-client.ts only when the key is set.
const enabled = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);

/** Identify by the opaque user id only: never names, emails, or health data. */
export function identifyUser(userId: string) {
  if (enabled) posthog.identify(userId);
}

export function resetAnalytics() {
  if (enabled) posthog.reset();
}
