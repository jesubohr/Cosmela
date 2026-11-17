import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

/** Limits for anonymous entry points. Keys: org id for bookings, lowercased email for login codes. */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  bookingPerHour: { kind: "fixed window", rate: 10, period: HOUR },
  bookingPerDay: { kind: "fixed window", rate: 30, period: 24 * HOUR },
  loginCodePerEmail: { kind: "fixed window", rate: 5, period: 15 * MINUTE },
  cookieReceipts: { kind: "fixed window", rate: 120, period: MINUTE },
});
