import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("missed appointment reminders", { minutes: 30 }, internal.notifications.sweepReminders, {});
crons.interval("unclaimed uploads", { hours: 6 }, internal.files.sweepUploads, {});
// 9:00 Bogotá.
crons.daily("trial reminders", { hourUTC: 14, minuteUTC: 0 }, internal.billing.sendTrialReminders, {});

export default crons;
