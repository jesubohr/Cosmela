import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { fail, getOwned, memberMutation } from "./lib/authz";
import { vTimeBlockKind } from "./lib/validators";

const DAY = 24 * 60 * 60_000;

const blockFields = {
  memberId: v.id("members"),
  start: v.number(),
  end: v.number(),
  allDay: v.boolean(),
  kind: vTimeBlockKind,
  title: v.optional(v.string()),
};

/** Staff block their own time; admins can block anyone's. */
async function checkMember(ctx: QueryCtx & { orgId: Id<"orgs">; member: Doc<"members"> }, memberId: Id<"members">) {
  const member = await getOwned(ctx, "members", memberId);
  if (ctx.member.role !== "admin" && member._id !== ctx.member._id) {
    fail("FORBIDDEN", "Solo un administrador puede bloquear el horario de otra persona.");
  }
}

function validate({ start, end, title }: { start: number; end: number; title?: string }) {
  if (end <= start) throw new ConvexError({ code: "INVALID", message: "La hora final debe ser después de la inicial." });
  if (end - start > DAY) throw new ConvexError({ code: "INVALID", message: "Un bloqueo no puede durar más de un día." });
  const trimmed = title?.trim();
  return trimmed ? trimmed : undefined;
}

export const create = memberMutation({
  args: blockFields,
  handler: async (ctx, args) => {
    await checkMember(ctx, args.memberId);
    const title = validate(args);
    return await ctx.db.insert("timeBlocks", { orgId: ctx.orgId, ...args, title });
  },
});

export const update = memberMutation({
  args: { blockId: v.id("timeBlocks"), ...blockFields },
  handler: async (ctx, { blockId, ...args }) => {
    const block = await getOwned(ctx, "timeBlocks", blockId);
    await checkMember(ctx, block.memberId);
    await checkMember(ctx, args.memberId);
    const title = validate(args);
    await ctx.db.patch(blockId, { ...args, title });
  },
});

export const remove = memberMutation({
  args: { blockId: v.id("timeBlocks") },
  handler: async (ctx, { blockId }) => {
    const block = await getOwned(ctx, "timeBlocks", blockId);
    await checkMember(ctx, block.memberId);
    await ctx.db.delete(blockId);
  },
});
