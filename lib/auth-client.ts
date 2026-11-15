import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Calls the Next.js route /api/auth/*, which proxies to the Convex site URL.
export const authClient = createAuthClient({
  plugins: [emailOTPClient(), convexClient()],
});
