import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

// Create a new bill and update stock atomically
export const createBill = mutation({
  args: {
    customerName: v.optional(v.string()),
    items: v.array(
      v.object({
        stockId: v.id("stock"),
        quantity: v.number(),
      }),
    ),
    paymentMethod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    if (args.items.length === 0) {
      throw new Error("Bill must contain at least one item");
    }

    // Consolidate duplicate stockId entries and validate quantities > 0
    const mergedQuantities = new Map<Id<"stock">, number>();
    for (const item of args.items) {
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        throw new Error("Item quantity must be a positive number");
      }
      mergedQuantities.set(
        item.stockId,
        (mergedQuantities.get(item.stockId) ?? 0) + item.quantity,
      );
    }

    // Validate stock availability and calculate totals
    const billItems: Array<{
      stockId: Id<"stock">;
      itemName: string;
      quantity: number;
      pricePerUnit: number;
      totalPrice: number;
      remainingQuantity: number;
    }> = [];
    let totalAmount = 0;

    for (const [stockId, quantity] of mergedQuantities.entries()) {
      const stock = await ctx.db.get(stockId);
      if (!stock || stock.userId !== user._id) {
        throw new Error(`Stock item not found: ${stockId}`);
      }

      if (stock.currentQuantity < quantity) {
        throw new Error(
          `Insufficient stock for ${stock.itemName} (available: ${stock.currentQuantity}, requested: ${quantity})`,
        );
      }

      const totalPrice = stock.pricePerUnit * quantity;
      billItems.push({
        stockId,
        itemName: stock.itemName,
        quantity,
        pricePerUnit: stock.pricePerUnit,
        totalPrice,
        remainingQuantity: stock.currentQuantity - quantity,
      });

      totalAmount += totalPrice;
    }

    // Create the bill
    const billId = await ctx.db.insert("bills", {
      userId: user._id,
      customerName: args.customerName?.trim() || undefined,
      items: billItems.map(({ stockId, itemName, quantity, pricePerUnit, totalPrice }) => ({
        stockId,
        itemName,
        quantity,
        pricePerUnit,
        totalPrice,
      })),
      totalAmount,
      paymentMethod: args.paymentMethod,
    });

    // Deduct stock quantities and record individual sales transactions
    for (const billItem of billItems) {
      await ctx.db.patch(billItem.stockId, {
        currentQuantity: billItem.remainingQuantity,
      });

      await ctx.db.insert("sales", {
        userId: user._id,
        stockId: billItem.stockId,
        itemName: billItem.itemName,
        quantitySold: billItem.quantity,
        pricePerUnit: billItem.pricePerUnit,
        totalAmount: billItem.totalPrice,
        billId,
      });
    }

    return billId;
  },
});

// Get all bills for current user
export const getBills = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    return await ctx.db
      .query("bills")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

// Get a specific bill
export const getBill = query({
  args: { billId: v.id("bills") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const bill = await ctx.db.get(args.billId);
    if (!bill || bill.userId !== user._id) {
      throw new Error("Bill not found");
    }

    return bill;
  },
});

// Get all sales for current user (for backups/exports)
export const getSales = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    return await ctx.db
      .query("sales")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});
