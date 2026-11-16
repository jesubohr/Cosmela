import posthog, { type CaptureResult } from "posthog-js";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

// Invitation links carry a bearer token in the path (also URL-encoded in `?next=`).
const INVITATION_TOKEN = /(\/|%2F)invitacion(\/|%2F)[^/?#&%]+/gi;

function scrub(values: Record<string, unknown> | undefined) {
  if (!values) return;
  for (const [name, value] of Object.entries(values)) {
    if (typeof value === "string") values[name] = value.replace(INVITATION_TOKEN, "$1invitacion$2token");
  }
}

function withoutTokens(event: CaptureResult | null) {
  if (!event) return null;
  scrub(event.properties);
  scrub(event.$set);
  scrub(event.$set_once);
  return event;
}

// Health app: no session replay, no captured text or attributes, opaque ids only.
if (key) {
  posthog.init(key, {
    api_host: "/ingest",
    ui_host: host.replace(".i.posthog.com", ".posthog.com"),
    defaults: "2025-05-24",
    person_profiles: "identified_only",
    disable_session_recording: true,
    mask_all_text: true,
    mask_all_element_attributes: true,
    before_send: withoutTokens,
  });
}
