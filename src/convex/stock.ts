import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

// Get all stock items for current user
export const getStock = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      // Return empty list instead of throwing to avoid client crash before auth is ready
      return [];
    }

    return await ctx.db
      .query("stock")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

// Add new stock item
export const addStock = mutation({
  args: {
    itemName: v.string(),
    currentQuantity: v.number(),
    pricePerUnit: v.number(),
    expiryDate: v.optional(v.number()),
    category: v.optional(v.string()),
    minStockLevel: v.optional(v.number()),
    unit: v.optional(v.string()),
    supplier: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    return await ctx.db.insert("stock", {
      userId: user._id,
      ...args,
    });
  },
});

// Update stock quantity (used when creating bills)
export const updateStockQuantity = mutation({
  args: {
    stockId: v.id("stock"),
    quantityChange: v.number(), // negative for sales, positive for restocking
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const stock = await ctx.db.get(args.stockId);
    if (!stock || stock.userId !== user._id) {
      throw new Error("Stock item not found");
    }

    const newQuantity = stock.currentQuantity + args.quantityChange;
    if (newQuantity < 0) {
      throw new Error("Insufficient stock");
    }

    await ctx.db.patch(args.stockId, {
      currentQuantity: newQuantity,
    });

    return newQuantity;
  },
});

// Get low stock alerts
export const getLowStockAlerts = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    const allStock = await ctx.db
      .query("stock")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return allStock.filter(item => {
      const minLevel = item.minStockLevel || 10; // default minimum
      return item.currentQuantity <= minLevel;
    });
  },
});

// Get expiring items (for pharmacies mainly)
export const getExpiringItems = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    const allStock = await ctx.db
      .query("stock")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const now = Date.now();
    const thirtyDaysFromNow = now + (30 * 24 * 60 * 60 * 1000);

    return allStock.filter(item => {
      return item.expiryDate && item.expiryDate <= thirtyDaysFromNow;
    });
  },
});