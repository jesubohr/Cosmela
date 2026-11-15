import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("missed appointment reminders", { minutes: 30 }, internal.notifications.sweepReminders, {});

export default crons;
