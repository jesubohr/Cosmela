import type { PostHog } from "posthog-js";

let initialized = false;
let allowed = false;
let pendingUserId: string | null = null;
let posthog: PostHog | undefined;
let loading: Promise<void> | undefined;

export function enableAnalytics() {
  allowed = true;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  if (!posthog) {
    loading ??= import("posthog-js").then(module => {
      posthog = module.default;
      if (allowed) enableAnalytics();
    }).catch(() => { loading = undefined; });
    return;
  }
  if (!initialized) {
    posthog.init(key, {
      api_host: "/ingest",
      ui_host: (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(".i.posthog.com", ".posthog.com"),
      defaults: "2025-05-24",
      person_profiles: "identified_only",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_performance: false,
      capture_exceptions: false,
      disable_session_recording: true,
      disable_surveys: true,
      advanced_disable_feature_flags: true,
      cookie_expiration: 365,
      mask_all_text: true,
      mask_all_element_attributes: true,
      before_send: () => null,
    });
    initialized = true;
  } else {
    posthog.opt_in_capturing();
  }
  if (pendingUserId) posthog.identify(pendingUserId);
}

export function disableAnalytics() {
  allowed = false;
  if (initialized) posthog?.opt_out_capturing();
  if (typeof window !== "undefined") {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (key) {
      const storageKey = `ph_${key}_posthog`;
      try { localStorage.removeItem(storageKey); sessionStorage.removeItem(storageKey); } catch { /* Storage may be unavailable. */ }
      document.cookie = `${storageKey}=; Max-Age=0; path=/; SameSite=Lax`;
      const parts = location.hostname.split(".");
      for (let i = 0; i < parts.length - 1; i++) {
        document.cookie = `${storageKey}=; Max-Age=0; path=/; domain=.${parts.slice(i).join(".")}; SameSite=Lax`;
      }
    }
  }
}

export function identifyUser(userId: string) {
  pendingUserId = userId;
  if (allowed && initialized) posthog?.identify(userId);
}

export function resetAnalytics() {
  pendingUserId = null;
  if (allowed && initialized) posthog?.reset();
}
