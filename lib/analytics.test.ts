import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const sdk = vi.hoisted(() => ({ init: vi.fn(), identify: vi.fn(), reset: vi.fn(), opt_in_capturing: vi.fn(), opt_out_capturing: vi.fn() }));
vi.mock("posthog-js", () => ({ default: sdk }));

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "test-key");
  vi.stubGlobal("document", { cookie: "" });
  vi.stubGlobal("location", { hostname: "cosmela.app" });
  vi.stubGlobal("localStorage", { removeItem: vi.fn() });
  vi.stubGlobal("sessionStorage", { removeItem: vi.fn() });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("optional analytics", () => {
  test("does not initialize or identify until accepted and disables automatic capture", async () => {
    const analytics = await import("./analytics");
    analytics.identifyUser("opaque-id");
    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.identify).not.toHaveBeenCalled();
    analytics.enableAnalytics();
    await vi.dynamicImportSettled();
    expect(sdk.init).toHaveBeenCalledWith("test-key", expect.objectContaining({ autocapture: false, capture_pageview: false, disable_session_recording: true, capture_exceptions: false }));
    expect(sdk.identify).toHaveBeenCalledWith("opaque-id");
    analytics.disableAnalytics();
    analytics.identifyUser("another-id");
    expect(sdk.identify).toHaveBeenCalledTimes(1);
    expect(sdk.opt_out_capturing).toHaveBeenCalledTimes(1);
    analytics.resetAnalytics();
    expect(sdk.reset).not.toHaveBeenCalled();
  });

  test("withdrawal during SDK loading prevents initialization", async () => {
    const analytics = await import("./analytics");
    analytics.enableAnalytics();
    analytics.disableAnalytics();
    await vi.dynamicImportSettled();
    expect(sdk.init).not.toHaveBeenCalled();
  });
});
