"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

// Helper: extract text from Gemini response safely
async function extractGeminiText(resp: Response) {
  const data = await resp.json().catch(() => null);
  if (!data) throw new Error("Invalid JSON from Gemini");

  // Basic extraction per v1beta generateContent
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ??
    "";

  if (!text) throw new Error("No content found in Gemini response");
  return text as string;
}

export const chatWithAI = action({
  args: {
    message: v.string(),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(api.users.currentUser);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Pull context data
    const stock = await ctx.runQuery(api.stock.getStock);
    const lowStock = await ctx.runQuery(api.stock.getLowStockAlerts);
    const expiring = await ctx.runQuery(api.stock.getExpiringItems);

    const shopType = user.shopType || "general";
    const language = args.language || user.language || "english";

    // Prepare context summary to reduce tokens
    const contextSummary = [
      `Shop Type: ${shopType}`,
      `Total Items: ${stock.length}`,
      `Low Stock: ${lowStock.length} (${lowStock.slice(0, 10).map(i => i.itemName).join(", ")})`,
      `Expiring in 30d: ${expiring.length} (${expiring.slice(0, 10).map(i => i.itemName).join(", ")})`,
      `Preferred Language: ${language}`,
    ].join("\n");

    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const API_KEY = GOOGLE_API_KEY || GEMINI_API_KEY;

    let responseText = "";

    if (API_KEY) {
      try {
        const endpoint =
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent";

        const systemPreamble =
          "You are StockSense AI, an assistant for small Indian retailers. Provide concise, actionable inventory and billing insights. Use the provided context. Keep answers practical.";

        const prompt = [
          systemPreamble,
          "",
          "Context:",
          contextSummary,
          "",
          "User message:",
          args.message,
          "",
          "Instructions:",
          "- If the user asks about low stock, list top items to reorder with brief reasoning.",
          "- If about expiry, list expiring items and suggest actions (discounts, priority sale).",
          "- If about sales/revenue, give high-level guidance and what to check next.",
          "- Keep the tone simple and professional.",
          language !== "english"
            ? `- Respond in ${language}.`
            : "- Respond in English.",
        ].join("\n");

        const body = {
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 500,
          },
        };

        const resp = await fetch(endpoint + `?key=${API_KEY}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!resp.ok) {
          const errText = await resp.text().catch(() => "");
          throw new Error(`Gemini error ${resp.status}: ${errText}`);
        }

        responseText = await extractGeminiText(resp);
      } catch (err) {
        // Soft fallback to mock behavior if Gemini fails
        console.error("Gemini call failed, falling back to mock:", err);
      }
    }

    // Fallback mock logic (if no key or call failed)
    if (!responseText) {
      const msg = args.message.toLowerCase();
      if (msg.includes("low stock") || msg.includes("reorder")) {
        responseText =
          lowStock.length > 0
            ? `You have ${lowStock.length} items running low: ${lowStock
                .map((i) => i.itemName)
                .join(", ")}. Consider restocking soon.`
            : "All your stock levels look good! No immediate restocking needed.";
      } else if (msg.includes("expiry") || msg.includes("expire")) {
        responseText =
          expiring.length > 0
            ? `${expiring.length} items are expiring within 30 days: ${expiring
                .map((i) => i.itemName)
                .join(", ")}. Consider offering discounts.`
            : "No items are expiring soon. Your inventory is fresh!";
      } else if (msg.includes("sales") || msg.includes("revenue")) {
        responseText = `Based on your ${shopType} shop type, focus on seasonal items. Check your dashboard for detailed analytics.`;
      } else {
        responseText = `As your AI assistant for your ${shopType} shop, I can help with inventory, sales insights, and restocking recommendations. What specific area would you like help with?`;
      }

      if (language === "hindi") responseText = `[Hindi] ${responseText}`;
      if (language === "malayalam") responseText = `[Malayalam] ${responseText}`;
    }

    // Save chat history
    await ctx.runMutation(api.ai.saveChatHistory, {
      userId: user._id,
      message: args.message,
      response: responseText,
      language,
    });

    return responseText;
  },
});
