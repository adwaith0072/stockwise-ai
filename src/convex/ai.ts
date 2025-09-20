import { v } from "convex/values";
import { action, mutation } from "./_generated/server";
import { api } from "./_generated/api";

export const chatWithAI = action({
  args: {
    message: v.string(),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // This would integrate with Gemini Pro API
    // For now, we'll return a mock response based on the message
    
    const user = await ctx.runQuery(api.users.currentUser);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Get user's stock data for context
    const stock = await ctx.runQuery(api.stock.getStock);
    const lowStock = await ctx.runQuery(api.stock.getLowStockAlerts);
    const expiring = await ctx.runQuery(api.stock.getExpiringItems);

    // Mock AI response based on shop type and data
    let response = "";
    const shopType = user.shopType || "general";
    const language = args.language || "english";

    if (args.message.toLowerCase().includes("low stock") || args.message.toLowerCase().includes("reorder")) {
      if (lowStock.length > 0) {
        response = `You have ${lowStock.length} items running low: ${lowStock.map(item => item.itemName).join(", ")}. Consider restocking soon.`;
      } else {
        response = "All your stock levels look good! No immediate restocking needed.";
      }
    } else if (args.message.toLowerCase().includes("expiry") || args.message.toLowerCase().includes("expire")) {
      if (expiring.length > 0) {
        response = `${expiring.length} items are expiring within 30 days: ${expiring.map(item => item.itemName).join(", ")}. Consider offering discounts.`;
      } else {
        response = "No items are expiring soon. Your inventory is fresh!";
      }
    } else if (args.message.toLowerCase().includes("sales") || args.message.toLowerCase().includes("revenue")) {
      response = `Based on your ${shopType} shop type, I recommend focusing on seasonal items. Check your dashboard for detailed sales analytics.`;
    } else {
      // General AI assistant response
      response = `As your AI assistant for your ${shopType} shop, I can help you with inventory management, sales insights, and restocking recommendations. What specific area would you like help with?`;
    }

    // Translate response based on language (mock implementation)
    if (language === "hindi") {
      // This would use actual translation API
      response = `[Hindi] ${response}`;
    } else if (language === "malayalam") {
      response = `[Malayalam] ${response}`;
    }

    // Save chat history
    await ctx.runMutation(api.ai.saveChatHistory, {
      userId: user._id,
      message: args.message,
      response,
      language,
    });

    return response;
  },
});

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
