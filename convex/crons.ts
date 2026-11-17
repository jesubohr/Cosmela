import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("missed appointment reminders", { minutes: 30 }, internal.notifications.sweepReminders, {});
crons.interval("unclaimed uploads", { hours: 6 }, internal.files.sweepUploads, {});
// 9:00 Bogotá.
crons.daily("trial reminders", { hourUTC: 14, minuteUTC: 0 }, internal.billing.sendTrialReminders, {});
crons.interval("closed organization retention", { hours: 1 }, internal.dataLifecycle.sweepDue, {});
crons.daily("expired legal evidence", { hourUTC: 8, minuteUTC: 0 }, internal.dataLifecycle.sweepEvidence, {});
crons.interval("verify file deletions", { minutes: 5 }, internal.fileDeletion.process, {});
crons.daily("platform legal evidence expiry", { hourUTC: 8, minuteUTC: 30 }, internal.legal.sweepExpiredEvidence, {});

export default crons;
