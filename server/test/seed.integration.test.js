import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

const mongoUri = process.env.MONGO_TEST_URI;

test("demo history seed preserves historical timestamps and is repeatable", {
  skip: !mongoUri && "Set MONGO_TEST_URI to a disposable MongoDB replica-set URI",
  timeout: 30000,
}, async (t) => {
  const original = Object.fromEntries([
    "SEED_ON_START", "SEED_DEMO_DATA", "SEED_ADMIN_EMAIL", "SEED_ADMIN_PASSWORD",
    "SEED_DELIVERY_PARTNERS", "SEED_DELIVERY_PARTNER_PASSWORD", "SEED_CUSTOMER_EMAILS", "SEED_CUSTOMER_PASSWORD",
  ].map((key) => [key, process.env[key]]));
  const suffix = `${process.pid}-${Date.now()}`;
  for (const [key, value] of Object.entries({
    SEED_ON_START: "true",
    SEED_DEMO_DATA: "true",
    SEED_ADMIN_EMAIL: `seed-admin-${suffix}@example.test`,
    SEED_ADMIN_PASSWORD: "SeedIntegration123!",
    SEED_DELIVERY_PARTNERS: `seed-partner-${suffix}@example.test`,
    SEED_DELIVERY_PARTNER_PASSWORD: "SeedIntegration123!",
    SEED_CUSTOMER_EMAILS: `seed-customer-${suffix}@example.test`,
    SEED_CUSTOMER_PASSWORD: "SeedIntegration123!",
  })) process.env[key] = value;

  const testUrl = new URL(mongoUri);
  testUrl.pathname = `/smart_grocery_seed_${suffix}`;
  await mongoose.connect(testUrl.toString());
  const [{ default: seedAll }, { default: Order }, { default: User }] = await Promise.all([
    import("../src/seed/seed.js"), import("../src/models/Order.js"), import("../src/models/User.js"),
  ]);
  t.after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  await seedAll();
  const customer = await User.findOne({ email: process.env.SEED_CUSTOMER_EMAILS });
  assert.ok(customer);
  const orders = await Order.find({ customer: customer._id }).sort({ createdAt: 1 }).lean();
  assert.equal(orders.length, 19);
  assert.ok(orders.at(0).createdAt < new Date(Date.now() - 50 * 86400000));
  assert.ok(Math.abs(orders.at(0).createdAt.getTime() - orders.at(0).updatedAt.getTime()) < 1000);

  await seedAll();
  assert.equal(await Order.countDocuments({ customer: customer._id }), 19);
});
