import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("missed appointment reminders", { minutes: 30 }, internal.notifications.sweepReminders, {});
crons.interval("unclaimed uploads", { hours: 6 }, internal.files.sweepUploads, {});

export default crons;
