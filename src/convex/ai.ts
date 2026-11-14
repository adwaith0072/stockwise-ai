import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

export const saveChatHistory = internalMutation({
  args: {
    userId: v.id("users"),
    message: v.string(),
    response: v.string(),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("chatHistory", args);
  },
});

export const getChatHistory = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    return await ctx.db
      .query("chatHistory")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("asc")
      .collect();
  },
});

export const clearChatHistory = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const rows = await ctx.db
      .query("chatHistory")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const row of rows) {
      await ctx.db.delete(row._id);
    }

    return rows.length;
  },
});
