import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

// Shop types for StockSense AI
export const SHOP_TYPES = {
  GROCERY: "grocery",
  PHARMACY: "pharmacy", 
  STATIONERY: "stationery",
  SUPERMARKET: "supermarket",
  GENERAL: "general",
} as const;

export const shopTypeValidator = v.union(
  v.literal(SHOP_TYPES.GROCERY),
  v.literal(SHOP_TYPES.PHARMACY),
  v.literal(SHOP_TYPES.STATIONERY),
  v.literal(SHOP_TYPES.SUPERMARKET),
  v.literal(SHOP_TYPES.GENERAL),
);
export type ShopType = Infer<typeof shopTypeValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
      
      // StockSense specific fields
      shopType: v.optional(shopTypeValidator),
      shopName: v.optional(v.string()),
      language: v.optional(v.string()), // preferred language for AI assistant
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // Stock/Inventory table
    stock: defineTable({
      userId: v.id("users"),
      itemName: v.string(),
      currentQuantity: v.number(),
      pricePerUnit: v.number(),
      expiryDate: v.optional(v.number()), // timestamp for expiry
      category: v.optional(v.string()),
      minStockLevel: v.optional(v.number()), // for low stock alerts
      unit: v.optional(v.string()),
      supplier: v.optional(v.string()),
    }).index("by_user", ["userId"])
      .index("by_user_and_item", ["userId", "itemName"]),

    // Sales transactions
    sales: defineTable({
      userId: v.id("users"),
      stockId: v.id("stock"),
      itemName: v.string(),
      quantitySold: v.number(),
      pricePerUnit: v.number(),
      totalAmount: v.number(),
      billId: v.optional(v.id("bills")),
    }).index("by_user", ["userId"])
      .index("by_stock", ["stockId"])
      .index("by_bill", ["billId"]),

    // Bills/Invoices
    bills: defineTable({
      userId: v.id("users"),
      customerName: v.optional(v.string()),
      items: v.array(v.object({
        stockId: v.id("stock"),
        itemName: v.string(),
        quantity: v.number(),
        pricePerUnit: v.number(),
        totalPrice: v.number(),
      })),
      totalAmount: v.number(),
      paymentMethod: v.optional(v.string()),
    }).index("by_user", ["userId"]),

    // AI Chat history
    chatHistory: defineTable({
      userId: v.id("users"),
      message: v.string(),
      response: v.string(),
      language: v.optional(v.string()),
    }).index("by_user", ["userId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;