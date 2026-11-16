import { v } from "convex/values";
import { scheduleError } from "../components/settings/schedule";
import { adminMutation, fail, getOwned, memberQuery, requireStaffRoom, unguardedMemberMutation } from "./lib/authz";
import { STAFF_COLORS, vRole, vScheduleRange, vStaffColor, type ScheduleRange, type StaffColor } from "./lib/validators";
import { invalid } from "./treatments";

export function checkSchedule(schedule: ScheduleRange[]) {
  const message = scheduleError(schedule);
  if (message) invalid(message);
}

export function checkPersonName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) invalid("Escribe tu nombre.");
  if (trimmed.length > 80) invalid("El nombre es demasiado largo.");
  return trimmed;
}

/** First staff color nobody in the team uses yet (plum when all are taken). */
export function nextFreeColor(used: StaffColor[]): StaffColor {
  return STAFF_COLORS.find((color) => !used.includes(color)) ?? "plum";
}

/** The caller's own member profile. */
export const me = memberQuery({
  args: {},
  handler: async (ctx) => {
    const { _id, name, title, color, email, role, signatureKey, schedule } = ctx.member;
    return { _id, name, title, color, email, role, signatureKey, schedule };
  },
});

/** Team members, active first, then by name. Includes each schedule (agenda shading, slots). */
export const list = memberQuery({
  args: {},
  handler: async (ctx) => {
    const org = await ctx.db.get(ctx.orgId);
    const members = await ctx.db
      .query("members")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect();
    return members
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "es"))
      .map((m) => ({
        _id: m._id,
        name: m.name,
        title: m.title,
        email: m.email,
        role: m.role,
        color: m.color,
        schedule: m.schedule,
        bookable: m.bookable,
        active: m.active,
        isOwner: m.userId === org?.ownerId,
        isMe: m._id === ctx.member._id,
      }));
  },
});

export const updateProfile = unguardedMemberMutation({
  args: { name: v.string(), title: v.optional(v.string()), color: vStaffColor },
  handler: async (ctx, args) => {
    await ctx.db.patch(ctx.member._id, {
      name: checkPersonName(args.name),
      title: args.title?.trim().slice(0, 40) || undefined,
      color: args.color,
    });
  },
});

export const updateSchedule = unguardedMemberMutation({
  args: { schedule: v.array(vScheduleRange) },
  handler: async (ctx, { schedule }) => {
    checkSchedule(schedule);
    await ctx.db.patch(ctx.member._id, { schedule });
  },
});

/** Admin changes to another member: role, online bookings, active. */
export const update = adminMutation({
  args: {
    id: v.id("members"),
    role: v.optional(vRole),
    bookable: v.optional(v.boolean()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, role, bookable, active }) => {
    const member = await getOwned(ctx, "members", id);
    const org = await ctx.db.get(ctx.orgId);
    const changesAccess = (role !== undefined && role !== member.role) || active === false;
    if (changesAccess && member.userId === org?.ownerId) {
      fail("FORBIDDEN", "No puedes cambiar el rol ni desactivar a quien creó el negocio.");
    }
    if (changesAccess && member._id === ctx.member._id) {
      fail("FORBIDDEN", "No puedes quitarte tu propio acceso de administrador.");
    }
    if (active && !member.active) await requireStaffRoom(ctx, ctx.orgId);
    await ctx.db.patch(id, {
      ...(role !== undefined && { role }),
      ...(bookable !== undefined && { bookable }),
      ...(active !== undefined && { active }),
    });
  },
});
