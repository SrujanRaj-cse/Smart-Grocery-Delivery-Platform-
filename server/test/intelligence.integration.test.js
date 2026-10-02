import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET ||= "integration-test-secret-with-at-least-32-characters";
process.env.LLM_API_KEY = "";

const mongoUri = process.env.MONGO_TEST_URI;
const [{ default: app }, { default: User }, { default: Product }, { default: Order }] = await Promise.all([
  import("../src/app.js"), import("../src/models/User.js"), import("../src/models/Product.js"), import("../src/models/Order.js"),
]);
const { closeRedisClient } = await import("../src/config/redis.js");

test("customer AI search and substitutions use catalog data; admin forecast is history-backed and RBAC protected", {
  skip: !mongoUri && "Set MONGO_TEST_URI to a disposable MongoDB replica-set URI",
  timeout: 20000,
}, async (t) => {
  const testUrl = new URL(mongoUri);
  testUrl.pathname = `/smart_grocery_intelligence_${process.pid}_${Date.now()}`;
  await mongoose.connect(testUrl.toString());
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeAllConnections();
    server.close();
    await closeRedisClient();
    await mongoose.disconnect();
  });

  const customer = await User.create({ name: "Catalog Customer", email: `catalog-${Date.now()}@example.test`, password: "Integration123!", role: "customer" });
  const admin = await User.create({ name: "Metrics Admin", email: `admin-${Date.now()}@example.test`, password: "Integration123!", role: "admin" });
  const tokenFor = (user) => jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "1h" });
  const customerHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${tokenFor(customer)}` };
  const milk = await Product.create({ name: "Demo Milk", category: "Dairy", price: 18, stock: 12, isActive: true });
  const alternative = await Product.create({ name: "Demo Oat Drink", category: "Dairy", price: 24, stock: 8, isActive: true });

  const assistantResponse = await fetch(`${baseUrl}/api/assistant/grocery`, {
    method: "POST", headers: customerHeaders, body: JSON.stringify({ message: "Milk under 20" }),
  });
  assert.equal(assistantResponse.status, 200);
  const assistant = await assistantResponse.json();
  assert.equal(assistant.mode, "catalog_search_fallback");
  assert.deepEqual(assistant.products.map((item) => String(item._id)), [String(milk._id)]);

  const substitutionsResponse = await fetch(`${baseUrl}/api/products/${milk._id}/substitutions`, { headers: customerHeaders });
  assert.equal(substitutionsResponse.status, 200);
  assert.equal(String((await substitutionsResponse.json())[0].product._id), String(alternative._id));

  await Order.create({
    customer: customer._id,
    items: [{ product: milk._id, name: milk.name, price: milk.price, quantity: 4 }, { product: alternative._id, name: alternative.name, price: alternative.price, quantity: 1 }],
    totalAmount: milk.price * 4 + alternative.price,
    address: "Synthetic demo street",
    status: "delivered",
    createdAt: new Date(Date.now() - 2 * 86400000),
  });
  const adminHeaders = { Authorization: `Bearer ${tokenFor(admin)}` };
  const forecastResponse = await fetch(`${baseUrl}/api/admin/analytics/forecast?productId=${milk._id}&horizonDays=3`, { headers: adminHeaders });
  assert.equal(forecastResponse.status, 200);
  const forecast = await forecastResponse.json();
  assert.equal(forecast.totalUnits, 4);
  assert.equal(forecast.observedDays, 1);
  assert.equal(forecast.confidence, "insufficient_history");
  const deniedCopilot = await fetch(`${baseUrl}/api/admin/copilot`, { headers: customerHeaders });
  assert.equal(deniedCopilot.status, 403);
});
