import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "test-only-secret-that-is-at-least-32-characters-long";
process.env.JWT_EXPIRES_IN = "1h";

const [{ register, login }, { default: requireRole }, { default: Product }, { default: User }, { default: Cart }, { default: Order }, orderService] = await Promise.all([
  import("../src/controllers/authController.js"),
  import("../src/middleware/requireRole.js"),
  import("../src/models/Product.js"),
  import("../src/models/User.js"),
  import("../src/models/Cart.js"),
  import("../src/models/Order.js"),
  import("../src/services/orderService.js"),
]);
const { updateProduct } = await import("../src/controllers/productController.js");
const { assertValidOrderTransition } = orderService;
const { ROLES, ORDER_STATUS } = await import("../src/utils/constants.js");

afterEach(() => mock.restoreAll());

const response = () => ({
  code: 200,
  body: null,
  status(code) { this.code = code; return this; },
  json(body) { this.body = body; return this; },
});

const fakeSession = () => ({
  async withTransaction(callback) { return callback(); },
  endSession() {},
});

const query = (resolveValue) => {
  const pending = {
    session() { return pending; },
    then(onFulfilled, onRejected) {
      return Promise.resolve().then(resolveValue).then(onFulfilled, onRejected);
    },
  };
  return pending;
};

test("registration always creates a customer and returns no password", async () => {
  mock.method(User, "findOne", async () => null);
  const created = { _id: new mongoose.Types.ObjectId(), name: "A Customer", email: "a@example.com", role: ROLES.CUSTOMER };
  mock.method(User, "create", async (document) => { assert.equal(document.role, ROLES.CUSTOMER); return created; });
  const res = response();
  await register({ body: { name: created.name, email: created.email, password: "strong-pass-123" } }, res);
  assert.equal(res.code, 201);
  assert.equal("password" in res.body.user, false);
  assert.equal(jwt.verify(res.body.token, process.env.JWT_SECRET).userId, String(created._id));
});

test("login rejects invalid credentials with the same response", async () => {
  mock.method(User, "findOne", () => ({ select: async () => null }));
  const res = response();
  await login({ body: { email: "missing@example.com", password: "wrong" } }, res);
  assert.equal(res.code, 401);
  assert.deepEqual(res.body, { message: "Invalid credentials" });
});

test("RBAC rejects a customer from admin-only handlers", () => {
  const res = response();
  let nextCalled = false;
  requireRole(ROLES.ADMIN)({ user: { role: ROLES.CUSTOMER } }, res, () => { nextCalled = true; });
  assert.equal(res.code, 403);
  assert.equal(nextCalled, false);
});

test("product updates allow known fields and reject protected or unknown fields", async () => {
  const productId = new mongoose.Types.ObjectId().toString();
  mock.method(Product, "findByIdAndUpdate", async (_id, update) => ({ _id, ...update.$set }));
  const ok = response();
  await updateProduct({ params: { id: productId }, body: { price: 4.25 } }, ok);
  assert.equal(ok.code, 200);
  const blocked = response();
  await updateProduct({ params: { id: productId }, body: { isActive: true } }, blocked);
  assert.equal(blocked.code, 400);
});

test("cart reads are scoped to the authenticated user", async () => {
  const { getCart } = await import("../src/controllers/cartController.js");
  const userId = new mongoose.Types.ObjectId();
  const product = { _id: new mongoose.Types.ObjectId(), name: "Rice", price: 2, stock: 5 };
  const cart = { items: [{ productId: product, quantity: 2 }] };
  mock.method(Cart, "findOne", (query) => {
    assert.equal(String(query.user), String(userId));
    return { populate: async () => cart };
  });
  const res = response();
  await getCart({ user: { _id: userId } }, res);
  assert.equal(res.body.cartCount, 2);
});

test("checkout trusts persisted cart quantities and clears the cart in the transaction", async () => {
  const customerId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  let deletedWithSession = false;
  mock.method(mongoose, "startSession", async () => fakeSession());
  mock.method(Cart, "findOne", () => query(() => ({ _id: new mongoose.Types.ObjectId(), items: [{ productId, quantity: 2 }] })));
  mock.method(Cart, "deleteOne", async (_query, options) => { deletedWithSession = Boolean(options.session); return { deletedCount: 1 }; });
  mock.method(Product, "findOne", () => query(() => ({ _id: productId, name: "Rice", price: 3, stock: 8 })));
  mock.method(Product, "updateOne", async (filter) => {
    assert.equal(filter.stock.$gte, 2);
    return { modifiedCount: 1 };
  });
  mock.method(Order, "create", async ([document]) => [{ ...document, save: async () => {} }]);
  const order = await orderService.createOrderWithStockLock({ customerId, address: "Test address" });
  assert.equal(order.totalAmount, 6);
  assert.equal(order.items[0].quantity, 2);
  assert.equal(deletedWithSession, true);
});

test("checkout refuses stock races using a conditional atomic decrement", async () => {
  let stock = 1;
  let createdOrders = 0;
  let deletedCarts = 0;
  mock.method(mongoose, "startSession", async () => fakeSession());
  const productId = new mongoose.Types.ObjectId();
  mock.method(Cart, "findOne", () => query(() => ({ _id: new mongoose.Types.ObjectId(), items: [{ productId, quantity: 1 }] })));
  mock.method(Cart, "deleteOne", async () => { deletedCarts += 1; return { deletedCount: 1 }; });
  mock.method(Product, "findOne", () => query(() => ({ _id: productId, name: "Milk", price: 2, stock })));
  mock.method(Product, "updateOne", async (filter, update) => {
    if (stock < filter.stock.$gte) return { modifiedCount: 0 };
    stock += update.$inc.stock;
    return { modifiedCount: 1 };
  });
  mock.method(Order, "create", async ([document]) => { createdOrders += 1; return [{ ...document, save: async () => {} }]; });
  const attempts = await Promise.allSettled([
    orderService.createOrderWithStockLock({ customerId: new mongoose.Types.ObjectId(), address: "A" }),
    orderService.createOrderWithStockLock({ customerId: new mongoose.Types.ObjectId(), address: "B" }),
  ]);
  assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(stock, 0);
  assert.equal(createdOrders, 1);
  assert.equal(deletedCarts, 1);
});

test("order lifecycle rejects skipped states and prevents partner cross-access", () => {
  const order = { status: ORDER_STATUS.CONFIRMED, deliveryPartner: new mongoose.Types.ObjectId() };
  assert.throws(() => assertValidOrderTransition({ order, newStatus: ORDER_STATUS.DELIVERED, actorRole: ROLES.DELIVERY_PARTNER, actorId: order.deliveryPartner }));
  order.status = ORDER_STATUS.ASSIGNED;
  assert.throws(() => assertValidOrderTransition({ order, newStatus: ORDER_STATUS.PICKED, actorRole: ROLES.DELIVERY_PARTNER, actorId: new mongoose.Types.ObjectId() }));
});

test("checkout idempotency returns the existing order without changing inventory", async () => {
  const existing = { _id: new mongoose.Types.ObjectId(), status: ORDER_STATUS.CONFIRMED };
  mock.method(Order, "findOne", () => query(() => existing));
  mock.method(mongoose, "startSession", async () => fakeSession());
  const order = await orderService.createOrderWithStockLock({ customerId: new mongoose.Types.ObjectId(), address: "A", checkoutKey: "retry-key-123" });
  assert.equal(order, existing);
});
