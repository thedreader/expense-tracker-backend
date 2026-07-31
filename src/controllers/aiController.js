import getAiClient from "../utils/aiClient.js";
import Category from "../models/Category.js";
import BUDGET_TYPES from "../utils/budgetTypes.js";

const responseSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      name: { type: "string", description: "Short expense name" },
      amount: { type: "number", description: "Amount in rupees, no symbols/commas" },
      category: { type: "string", description: "Best match from the given category list, or 'Uncategorized'" },
      budgetType: { type: "string", enum: BUDGET_TYPES },
      date: { type: "string", description: "ISO date, YYYY-MM-DD" },
    },
    required: ["name", "amount", "category", "budgetType", "date"],
  },
};

export const parseExpenseText = async (req, res) => {
  try {
    const ai = getAiClient();
    const userId = req.user.id;
    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ message: "Text is required" });

    const categories = await Category.find({ userId }).select("name");
    const categoryNames = categories.map((c) => c.name);
    const today = new Date().toISOString().slice(0, 10);

    const prompt = `Extract expense entries from casual text into structured JSON.

Today's date: ${today}
User's existing categories: ${categoryNames.length ? categoryNames.join(", ") : "(none yet)"}
Valid budgetType values: ${BUDGET_TYPES.join(", ")}

Rules:
- One JSON entry per distinct expense mentioned.
- Resolve relative dates ("today", "yesterday", "last Friday") against today's date.
- Pick the closest matching category from the list above; use "Uncategorized" if nothing fits — never invent a new category name.
- Infer budgetType from context (rent/groceries/bills → needs, dining/shopping → wants, SIP/stocks → investments). Default "wants" if unclear.
- amount is a plain number, no currency symbols or commas.

Text: "${text}"`;

    const result = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema },
    });

    const parsed = JSON.parse(result.text);
    const categoryMap = new Map(categoryNames.map((n) => [n.toLowerCase(), n]));

    const drafts = parsed.map((item) => ({
      name: item.name,
      amount: item.amount,
      category: categoryMap.get(String(item.category).toLowerCase()) || null,
      budgetType: BUDGET_TYPES.includes(item.budgetType) ? item.budgetType : "wants",
      date: item.date,
    }));

    res.status(200).json({ drafts });
  } catch (err) {
    if (err?.status === 429) {
      return res.status(429).json({ message: "AI rate limit hit — try again shortly" });
    }
    console.error("Error parsing expense text: ", err);
    res.status(500).json({ message: "Could not parse expense text" });
  }
};