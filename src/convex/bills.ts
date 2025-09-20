import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

// Create a new bill and update stock
export const createBill = mutation({
  args: {
    customerName: v.optional(v.string()),
    items: v.array(v.object({
      stockId: v.id("stock"),
      quantity: v.number(),
    })),
    paymentMethod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Validate stock and calculate totals
    const billItems = [];
    let totalAmount = 0;

    for (const item of args.items) {
      const stock = await ctx.db.get(item.stockId);
      if (!stock || stock.userId !== user._id) {
        throw new Error(`Stock item not found: ${item.stockId}`);
      }

      if (stock.currentQuantity < item.quantity) {
        throw new Error(`Insufficient stock for ${stock.itemName}`);
      }

      const totalPrice = stock.pricePerUnit * item.quantity;
      billItems.push({
        stockId: item.stockId,
        itemName: stock.itemName,
        quantity: item.quantity,
        pricePerUnit: stock.pricePerUnit,
        totalPrice,
      });

      totalAmount += totalPrice;
    }

    // Create the bill
    const billId = await ctx.db.insert("bills", {
      userId: user._id,
      customerName: args.customerName,
      items: billItems,
      totalAmount,
      paymentMethod: args.paymentMethod,
    });

    // Update stock quantities and create sales records
    for (let i = 0; i < args.items.length; i++) {
      const item = args.items[i];
      const billItem = billItems[i];

      // Update stock
      const stock = await ctx.db.get(item.stockId);
      await ctx.db.patch(item.stockId, {
        currentQuantity: stock!.currentQuantity - item.quantity,
      });

      // Create sales record
      await ctx.db.insert("sales", {
        userId: user._id,
        stockId: item.stockId,
        itemName: billItem.itemName,
        quantitySold: item.quantity,
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
      // Return empty list instead of throwing to avoid client crash before auth is ready
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

// Add: Get all sales for current user (for backups/exports)
export const getSales = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      // Return empty for unauthenticated to avoid client crash
      return [];
    }

    return await ctx.db
      .query("sales")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});