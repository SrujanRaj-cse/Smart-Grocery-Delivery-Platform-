import { generateStructured } from "./provider.js";
import { listProducts } from "../services/intelligence.js";

const validIntent = (value) => value && typeof value === "object"
  && !Array.isArray(value)
  && Object.keys(value).every((key) => ["terms", "category", "maxPrice"].includes(key))
  && typeof value.terms === "string" && value.terms.length <= 100
  && (value.category === null || (typeof value.category === "string" && value.category.length <= 80))
  && (value.maxPrice === null || (Number.isFinite(value.maxPrice) && value.maxPrice >= 0 && value.maxPrice <= 100000));

export const assistantSearch = async (message) => {
  const safeMessage = String(message).trim().slice(0, 500);
  let intent;
  try {
    intent = await generateStructured({
      system: "Extract grocery search intent only. Return JSON {terms:string,category:string|null,maxPrice:number|null}. Never invent products, prices, stock, or database filters. Use null if unspecified.",
      input: safeMessage,
      schema: validIntent,
    });
  } catch {
    intent = null;
  }
  if (!intent) {
    const priceMatch = safeMessage.match(/(?:under|below|less than)\s*[₹$]?\s*(\d+(?:\.\d+)?)/i);
    intent = {
      terms: safeMessage.replace(/(?:under|below|less than)\s*[₹$]?\s*\d+(?:\.\d+)?/ig, "").trim(),
      category: null,
      maxPrice: priceMatch ? Number(priceMatch[1]) : null,
    };
  }
  const products = await listProducts({ q: intent.terms, category: intent.category || undefined, maxPrice: intent.maxPrice, inStock: "true", limit: 12 });
  return {
    mode: process.env.LLM_API_KEY ? "llm_intent_with_catalog_grounding" : "catalog_search_fallback",
    message: products.length ? `Found ${products.length} matching in-stock products from the current catalogue.` : "No in-stock catalogue matches were found. Try a broader search.",
    intent,
    products: products.map(({ _id, name, category, price, stock, unit, imageUrl }) => ({ _id, name, category, price, stock, unit, imageUrl })),
  };
};
