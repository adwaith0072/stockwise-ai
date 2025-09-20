import { v } from "convex/values";
import { action, mutation } from "./_generated/server";
import { api } from "./_generated/api";

export const saveChatHistory = mutation({
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