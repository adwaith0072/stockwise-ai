import { getAuthUserId } from "@convex-dev/auth/server";
import { query, QueryCtx, mutation } from "./_generated/server";
import { v } from "convex/values";
import { shopTypeValidator } from "./schema";

export function normalizeLanguage(lang?: string): string {
  if (!lang) return "english";
  const clean = lang.trim().toLowerCase();
  if (clean === "hi" || clean === "hindi") return "hindi";
  if (clean === "ml" || clean === "malayalam") return "malayalam";
  return "english";
}

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user === null) {
      return null;
    }

    return user;
  },
});

/**
 * Use this function internally to get the current user data.
 */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
};

// Update user profile with shop details
export const updateProfile = mutation({
  args: {
    shopType: shopTypeValidator,
    shopName: v.optional(v.string()),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    await ctx.db.patch(user._id, {
      shopType: args.shopType,
      shopName: args.shopName?.trim() || undefined,
      language: normalizeLanguage(args.language),
    });

    return user._id;
  },
});

// Update settings mutation
export const updateSettings = mutation({
  args: {
    // Account
    shopType: v.optional(shopTypeValidator),
    shopName: v.optional(v.string()),
    ownerName: v.optional(v.string()),
    contactNumber: v.optional(v.string()),
    language: v.optional(v.string()),

    // Inventory & Billing
    defaultUnits: v.optional(v.string()),

    // AI Assistant
    aiEnableSeasonal: v.optional(v.boolean()),
    aiEnableDeadStock: v.optional(v.boolean()),
    aiAlertFrequency: v.optional(v.string()), // "daily" | "weekly" | "real-time"

    // Notifications
    notifyLowStock: v.optional(v.boolean()),
    notifyExpiry: v.optional(v.boolean()),
    notifySeasonal: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    await ctx.db.patch(user._id, {
      ...args,
      shopName: args.shopName !== undefined ? args.shopName.trim() || undefined : user.shopName,
      ownerName: args.ownerName !== undefined ? args.ownerName.trim() || undefined : user.ownerName,
      contactNumber:
        args.contactNumber !== undefined ? args.contactNumber.trim() || undefined : user.contactNumber,
      language: args.language !== undefined ? normalizeLanguage(args.language) : user.language,
    });

    return user._id;
  },
});

// Danger zone - clear all data for current user
export const clearData = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Delete stock
    const stockRows = await ctx.db
      .query("stock")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const row of stockRows) {
      await ctx.db.delete(row._id);
    }

    // Delete sales
    const salesRows = await ctx.db
      .query("sales")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const row of salesRows) {
      await ctx.db.delete(row._id);
    }

    // Delete bills
    const billRows = await ctx.db
      .query("bills")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const row of billRows) {
      await ctx.db.delete(row._id);
    }

    // Delete AI chat history
    const chatRows = await ctx.db
      .query("chatHistory")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const row of chatRows) {
      await ctx.db.delete(row._id);
    }

    return "cleared";
  },
});
