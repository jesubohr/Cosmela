import posthog from "posthog-js";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

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
  });
}
