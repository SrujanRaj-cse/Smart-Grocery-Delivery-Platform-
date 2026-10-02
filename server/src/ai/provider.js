const DEFAULT_MODEL = "gpt-4o-mini";

export const generateStructured = async ({ system, input, schema }) => {
  const apiKey = process.env.LLM_API_KEY;
  const endpoint = process.env.LLM_BASE_URL || "https://api.openai.com/v1/chat/completions";
  if (!apiKey) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || DEFAULT_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: input }],
        max_tokens: 300,
      }),
    });
    if (!response.ok) throw new Error(`LLM provider returned ${response.status}`);
    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    if (!content || content.length > 4000) return null;
    const parsed = JSON.parse(content);
    if (!schema(parsed)) return null;
    return parsed;
  } finally {
    clearTimeout(timer);
  }
};
