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
    // Add: Pull recent bills to infer sales trends
    const allBills = await ctx.runQuery(api.bills.getBills);

    const shopType = user.shopType || "general";
    const language = args.language || user.language || "english";

    // Add: compute recent (30d) sales by item
    const now = Date.now();
    const windowMs = 30 * 24 * 60 * 60 * 1000;
    const since = now - windowMs;
    type SalesAgg = { qty: number; revenue: number };
    const salesByItem: Record<string, SalesAgg> = {};
    for (const b of allBills) {
      // _creationTime exists on all documents
      const created = (b as any)._creationTime as number | undefined;
      if (created && created >= since) {
        for (const it of b.items) {
          const key = it.itemName;
          if (!salesByItem[key]) salesByItem[key] = { qty: 0, revenue: 0 };
          salesByItem[key].qty += it.quantity;
          salesByItem[key].revenue += it.totalPrice;
        }
      }
    }
    const days = 30;
    const topSellers = Object.entries(salesByItem)
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 10)
      .map(([name, agg]) => {
        const avgDaily = agg.qty / days;
        return `${name} (30d sold: ${agg.qty}, ~${avgDaily.toFixed(2)}/day)`;
      });

    // Add: derive reorder suggestions using sales velocity and current qty
    const suggestions: Array<string> = [];
    for (const s of stock) {
      const soldAgg = salesByItem[s.itemName];
      const avgDaily = soldAgg ? soldAgg.qty / days : 0;
      const minLevel = s.minStockLevel ?? 10;
      // target coverage: 14 days
      const target = Math.ceil(avgDaily * 14);
      const deficit = Math.max(0, target - s.currentQuantity);
      const shouldSuggest =
        (avgDaily > 0 && s.currentQuantity < avgDaily * 7) || s.currentQuantity <= minLevel;

      if (shouldSuggest && deficit > 0) {
        const unitStr = s.unit ? ` ${s.unit}` : "";
        const noteParts: Array<string> = [];
        if (avgDaily > 0) noteParts.push(`~${avgDaily.toFixed(2)}/day`);
        if (s.currentQuantity <= minLevel) noteParts.push(`≤ min (${minLevel})`);
        const note = noteParts.length ? ` — ${noteParts.join(", ")}` : "";
        suggestions.push(`${s.itemName}: order ~${deficit}${unitStr}${note}`);
      }
    }

    // Prepare context summary to reduce tokens
    const contextSummary = [
      `Shop Type: ${shopType}`,
      `Total Items: ${stock.length}`,
      `Low Stock: ${lowStock.length} (${lowStock.slice(0, 10).map(i => i.itemName).join(", ")})`,
      `Expiring in 30d: ${expiring.length} (${expiring.slice(0, 10).map(i => i.itemName).join(", ")})`,
      topSellers.length ? `Top Sellers (30d): ${topSellers.join("; ")}` : `Top Sellers (30d): None`,
      suggestions.length ? `Reorder Suggestions: ${suggestions.join("; ")}` : `Reorder Suggestions: None`,
      `Preferred Language: ${language}`,
    ].join("\n");

    // Prefer OpenRouter if available; fall back to Gemini if configured
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY as string | undefined;
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY as string | undefined;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY as string | undefined;

    let responseText = "";

    // Build a shared prompt once for both providers
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
      "- Base recommendations on 30-day sales velocity and current stock.",
      "- If asked 'what stock should I increase' or similar, list items with low stock vs sales and propose order quantities to cover ~14 days.",
      "- Consider minStockLevel if provided.",
      "- If expiring soon, avoid recommending large replenishments; mention caution.",
      "- Present clear bullets: Item — Reason — Suggested Order.",
      "- Keep the tone simple and professional.",
      language !== "english" ? `- Respond in ${language}.` : "- Respond in English.",
    ].join("\n");

    // Try OpenRouter first if configured
    if (OPENROUTER_API_KEY) {
      try {
        const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          },
          body: JSON.stringify({
            model: "google/gemini-1.5-pro",
            messages: [
              { role: "system", content: systemPreamble },
              { role: "user", content: prompt },
            ],
            temperature: 0.4,
            max_tokens: 700,
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text().catch(() => "");
          throw new Error(`OpenRouter error ${resp.status}: ${errText}`);
        }

        const data = await resp.json();
        responseText = data?.choices?.[0]?.message?.content ?? "";
      } catch (err) {
        console.error("OpenRouter call failed, attempting Gemini fallback:", err);
      }
    }

    // Fallback to direct Gemini API if OpenRouter not used or failed
    if (!responseText && (GOOGLE_API_KEY || GEMINI_API_KEY)) {
      try {
        const API_KEY = GOOGLE_API_KEY || GEMINI_API_KEY;
        const endpoint =
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent";

        const body = {
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 700,
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

    // Fallback mock logic (if no key or call failed), improved with suggestions
    if (!responseText) {
      const msg = args.message.toLowerCase();
      if (
        msg.includes("what stock should i increase") ||
        msg.includes("increase stock") ||
        msg.includes("reorder") ||
        msg.includes("low stock")
      ) {
        responseText =
          suggestions.length > 0
            ? `Based on recent trends, consider increasing:\n- ${suggestions.join("\n- ")}`
            : "No clear increase needed right now based on the last 30 days of sales and current stock.";
      } else if (msg.includes("expiry") || msg.includes("expire")) {
        responseText =
          expiring.length > 0
            ? `${expiring.length} items are expiring within 30 days: ${expiring
                .map((i) => i.itemName)
                .join(", ")}. Consider discounts and priority sale.`
            : "No items are expiring soon. Your inventory is fresh!";
      } else if (msg.includes("sales") || msg.includes("revenue")) {
        responseText =
          topSellers.length > 0
            ? `Top sellers in the last 30 days:\n- ${topSellers.join(
                "\n- ",
              )}\nFocus on stock availability for these items.`
            : "No sales data found in the last 30 days.";
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