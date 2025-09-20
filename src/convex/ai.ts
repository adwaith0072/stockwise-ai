import { v } from "convex/values";
import { mutation } from "./_generated/server";

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