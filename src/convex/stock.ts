import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

// Get all stock items for current user
export const getStock = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    return await ctx.db
      .query("stock")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

// Add new stock item (or upsert if an item with the same name already exists for this user)
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

    const itemName = args.itemName.trim();
    if (!itemName) {
      throw new Error("Item name is required");
    }
    if (!Number.isFinite(args.currentQuantity) || args.currentQuantity < 0) {
      throw new Error("Quantity must be zero or greater");
    }
    if (!Number.isFinite(args.pricePerUnit) || args.pricePerUnit < 0) {
      throw new Error("Price per unit must be zero or greater");
    }
    if (
      args.minStockLevel !== undefined &&
      (!Number.isFinite(args.minStockLevel) || args.minStockLevel < 0)
    ) {
      throw new Error("Minimum stock level must be zero or greater");
    }

    const existing = await ctx.db
      .query("stock")
      .withIndex("by_user_and_item", (q) =>
        q.eq("userId", user._id).eq("itemName", itemName),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        currentQuantity: existing.currentQuantity + args.currentQuantity,
        pricePerUnit: args.pricePerUnit,
        expiryDate: args.expiryDate ?? existing.expiryDate,
        category: args.category?.trim() || existing.category,
        minStockLevel: args.minStockLevel ?? existing.minStockLevel,
        unit: args.unit?.trim() || existing.unit,
        supplier: args.supplier?.trim() || existing.supplier,
      });
      return existing._id;
    }

    return await ctx.db.insert("stock", {
      userId: user._id,
      itemName,
      currentQuantity: args.currentQuantity,
      pricePerUnit: args.pricePerUnit,
      expiryDate: args.expiryDate,
      category: args.category?.trim() || undefined,
      minStockLevel: args.minStockLevel,
      unit: args.unit?.trim() || undefined,
      supplier: args.supplier?.trim() || undefined,
    });
  },
});

// Bulk upsert stock items from CSV/Excel imports
export const bulkUpsertStock = mutation({
  args: {
    items: v.array(
      v.object({
        itemName: v.string(),
        currentQuantity: v.number(),
        pricePerUnit: v.number(),
        expiryDate: v.optional(v.number()),
        category: v.optional(v.string()),
        minStockLevel: v.optional(v.number()),
        unit: v.optional(v.string()),
        supplier: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    let inserted = 0;
    let updated = 0;

    for (const raw of args.items) {
      const itemName = raw.itemName.trim();
      if (
        !itemName ||
        !Number.isFinite(raw.currentQuantity) ||
        raw.currentQuantity < 0 ||
        !Number.isFinite(raw.pricePerUnit) ||
        raw.pricePerUnit < 0
      ) {
        continue;
      }

      const existing = await ctx.db
        .query("stock")
        .withIndex("by_user_and_item", (q) =>
          q.eq("userId", user._id).eq("itemName", itemName),
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          currentQuantity: raw.currentQuantity,
          pricePerUnit: raw.pricePerUnit,
          expiryDate: raw.expiryDate ?? existing.expiryDate,
          category: raw.category?.trim() || existing.category,
          minStockLevel: raw.minStockLevel ?? existing.minStockLevel,
          unit: raw.unit?.trim() || existing.unit,
          supplier: raw.supplier?.trim() || existing.supplier,
        });
        updated++;
      } else {
        await ctx.db.insert("stock", {
          userId: user._id,
          itemName,
          currentQuantity: raw.currentQuantity,
          pricePerUnit: raw.pricePerUnit,
          expiryDate: raw.expiryDate,
          category: raw.category?.trim() || undefined,
          minStockLevel: raw.minStockLevel,
          unit: raw.unit?.trim() || undefined,
          supplier: raw.supplier?.trim() || undefined,
        });
        inserted++;
      }
    }

    return { inserted, updated };
  },
});

// Update stock quantity (used when adjusting stock directly)
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

export const updateStockDetails = mutation({
  args: {
    stockId: v.id("stock"),
    itemName: v.optional(v.string()),
    currentQuantity: v.optional(v.number()),
    pricePerUnit: v.optional(v.number()),
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

    const { stockId, ...patch } = args;
    const stock = await ctx.db.get(stockId);
    if (!stock || stock.userId !== user._id) {
      throw new Error("Stock item not found");
    }

    if (patch.itemName !== undefined) {
      patch.itemName = patch.itemName.trim();
      if (!patch.itemName) {
        throw new Error("Item name cannot be empty");
      }
    }
    if (
      patch.currentQuantity !== undefined &&
      (!Number.isFinite(patch.currentQuantity) || patch.currentQuantity < 0)
    ) {
      throw new Error("Quantity must be zero or greater");
    }
    if (
      patch.pricePerUnit !== undefined &&
      (!Number.isFinite(patch.pricePerUnit) || patch.pricePerUnit < 0)
    ) {
      throw new Error("Price per unit must be zero or greater");
    }
    if (
      patch.minStockLevel !== undefined &&
      (!Number.isFinite(patch.minStockLevel) || patch.minStockLevel < 0)
    ) {
      throw new Error("Minimum stock level must be zero or greater");
    }

    await ctx.db.patch(stockId, patch);
    return stockId;
  },
});

// Delete a stock item
export const deleteStock = mutation({
  args: {
    stockId: v.id("stock"),
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

    await ctx.db.delete(args.stockId);
    return args.stockId;
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

    return allStock.filter((item) => {
      const minLevel = item.minStockLevel ?? 10; // default minimum (0 is respected)
      return item.currentQuantity <= minLevel;
    });
  },
});

// Get expiring items (only items currently in stock)
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
    const thirtyDaysFromNow = now + 30 * 24 * 60 * 60 * 1000;

    return allStock.filter((item) => {
      return (
        item.currentQuantity > 0 &&
        Boolean(item.expiryDate && item.expiryDate <= thirtyDaysFromNow)
      );
    });
  },
});
