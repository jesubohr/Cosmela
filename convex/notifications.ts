import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// Hooks called by appointment mutations (in the same transaction, via `ctx.runMutation`).
// They do nothing until reminders and emails exist (Phase 3B).

/** Schedules the reminder email ~24 h before the appointment and stores `reminderJobId`. */
export const scheduleReminder = internalMutation({
  args: { appointmentId: v.id("appointments") },
  handler: async () => null,
});

/** Cancels the scheduled reminder of an appointment, if any. */
export const cancelReminder = internalMutation({
  args: { appointmentId: v.id("appointments") },
  handler: async () => null,
});

/** Sends "Cita confirmada" to the client when the client has an email. */
export const sendAppointmentConfirmed = internalMutation({
  args: { appointmentId: v.id("appointments") },
  handler: async () => null,
});
