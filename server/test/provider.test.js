import test from "node:test";
import assert from "node:assert/strict";
import { generateStructured } from "../src/ai/provider.js";

test("structured provider accepts only output matching the application schema", async (t) => {
  const priorKey = process.env.LLM_API_KEY;
  process.env.LLM_API_KEY = "test-key";
  t.after(() => { if (priorKey === undefined) delete process.env.LLM_API_KEY; else process.env.LLM_API_KEY = priorKey; });
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ terms: "milk", category: null, maxPrice: 25 }) } }] }) };
  };
  const result = await generateStructured({ system: "Extract bounded grocery intent", input: "milk under 25", schema: (value) => typeof value.terms === "string" });
  assert.deepEqual(result, { terms: "milk", category: null, maxPrice: 25 });
  assert.equal(request.url, "https://api.openai.com/v1/chat/completions");
  assert.equal(request.body.response_format.type, "json_object");
  assert.equal(request.body.messages[1].content, "milk under 25");
});

test("structured provider rejects output that fails the caller validator", async (t) => {
  const priorKey = process.env.LLM_API_KEY;
  process.env.LLM_API_KEY = "test-key";
  t.after(() => { if (priorKey === undefined) delete process.env.LLM_API_KEY; else process.env.LLM_API_KEY = priorKey; });
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{"mongoFilter":{"$where":"true"}}' } }] }) });
  const result = await generateStructured({ system: "Return safe search terms", input: "anything", schema: (value) => typeof value.terms === "string" });
  assert.equal(result, null);
});
