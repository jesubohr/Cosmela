/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as appointments from "../appointments.js";
import type * as auth from "../auth.js";
import type * as booking from "../booking.js";
import type * as cases from "../cases.js";
import type * as clients from "../clients.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as files from "../files.js";
import type * as followUps from "../followUps.js";
import type * as http from "../http.js";
import type * as invitations from "../invitations.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_consent from "../lib/consent.js";
import type * as lib_emails from "../lib/emails.js";
import type * as lib_slots from "../lib/slots.js";
import type * as lib_text from "../lib/text.js";
import type * as lib_time from "../lib/time.js";
import type * as lib_validators from "../lib/validators.js";
import type * as members from "../members.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as orgs from "../orgs.js";
import type * as payments from "../payments.js";
import type * as rateLimits from "../rateLimits.js";
import type * as reports from "../reports.js";
import type * as seed from "../seed.js";
import type * as sessions from "../sessions.js";
import type * as templates from "../templates.js";
import type * as timeBlocks from "../timeBlocks.js";
import type * as treatments from "../treatments.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  appointments: typeof appointments;
  auth: typeof auth;
  booking: typeof booking;
  cases: typeof cases;
  clients: typeof clients;
  crons: typeof crons;
  dashboard: typeof dashboard;
  files: typeof files;
  followUps: typeof followUps;
  http: typeof http;
  invitations: typeof invitations;
  "lib/authz": typeof lib_authz;
  "lib/consent": typeof lib_consent;
  "lib/emails": typeof lib_emails;
  "lib/slots": typeof lib_slots;
  "lib/text": typeof lib_text;
  "lib/time": typeof lib_time;
  "lib/validators": typeof lib_validators;
  members: typeof members;
  migrations: typeof migrations;
  notifications: typeof notifications;
  orgs: typeof orgs;
  payments: typeof payments;
  rateLimits: typeof rateLimits;
  reports: typeof reports;
  seed: typeof seed;
  sessions: typeof sessions;
  templates: typeof templates;
  timeBlocks: typeof timeBlocks;
  treatments: typeof treatments;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  r2: import("@convex-dev/r2/_generated/component.js").ComponentApi<"r2">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
};
