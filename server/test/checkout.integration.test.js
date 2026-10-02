import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import http from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET ||= "integration-test-secret-with-at-least-32-characters";
process.env.LLM_API_KEY = "";

const mongoUri = process.env.MONGO_TEST_URI;
const { closeRedisClient } = await import("../src/config/redis.js");
const requireClient = createRequire(new URL("../../client/package.json", import.meta.url));
const { io } = requireClient("socket.io-client");
const [{ default: app }, { initSocket }, { default: User }, { default: Product }, { default: Cart }, { default: Order }] = await Promise.all([
  import("../src/app.js"),
  import("../src/socket/socket.js"),
  import("../src/models/User.js"),
  import("../src/models/Product.js"),
  import("../src/models/Cart.js"),
  import("../src/models/Order.js"),
]);

test("checkout transactions commit, rollback, serialize stock races, and scope realtime events", {
  skip: !mongoUri && "Set MONGO_TEST_URI to a disposable MongoDB replica-set URI",
}, async (t) => {
  const testUrl = new URL(mongoUri);
  testUrl.pathname = `/smart_grocery_test_${process.pid}_${Date.now()}`;
  await mongoose.connect(testUrl.toString());
  await mongoose.connection.db.dropDatabase();

  const server = http.createServer(app);
  const socketServer = initSocket(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const apiUrl = `http://127.0.0.1:${server.address().port}`;
  const sockets = [];

  t.after(async () => {
    const bounded = (promise) => Promise.race([promise, new Promise((resolve) => setTimeout(resolve, 1500))]);
    for (const socket of sockets) socket.disconnect();
    server.closeAllConnections();
    socketServer.close();
    await bounded(new Promise((resolve) => server.close(resolve)));
    await closeRedisClient();
    await bounded(mongoose.connection.dropDatabase());
    await bounded(mongoose.disconnect());
  });

  const makeCustomer = async (label) => {
    const user = await User.create({ name: label, email: `${label.toLowerCase()}-${Date.now()}@example.test`, password: "Integration123!", role: "customer" });
    return { user, token: jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "1h" }) };
  };
  const makeProduct = (name, stock, price = 10) => Product.create({ name, stock, price, isActive: true });
  const setCart = (user, items) => Cart.create({ user: user._id, items });
  const checkout = (token, key) => fetch(`${apiUrl}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": key },
    body: JSON.stringify({ address: "12 Example Road", items: [{ productId: new mongoose.Types.ObjectId(), quantity: 99 }] }),
  });
  const customer = await makeCustomer("Primary");
  const socket = io(apiUrl, { auth: { token: customer.token }, transports: ["websocket"], reconnection: false });
  sockets.push(socket);
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  const stockEvents = [];
  socket.on("stockUpdated", (event) => stockEvents.push(event));

  const unauthenticatedSocket = io(apiUrl, { transports: ["websocket"], reconnection: false });
  sockets.push(unauthenticatedSocket);
  await new Promise((resolve) => unauthenticatedSocket.once("connect_error", resolve));
  assert.equal(unauthenticatedSocket.connected, false);

  // Duplicate cart lines are combined; prices and quantities come from MongoDB, not request JSON.
  const rice = await makeProduct("Rice", 10, 12);
  await setCart(customer.user, [
    { productId: rice._id, quantity: 1 },
    { productId: rice._id, quantity: 2 },
  ]);
  const firstEvent = new Promise((resolve) => socket.once("stockUpdated", resolve));
  const successful = await checkout(customer.token, "successful-order-key-001");
  assert.equal(successful.status, 201);
  const order = await successful.json();
  assert.equal(order.items.length, 1);
  assert.equal(order.items[0].quantity, 3);
  assert.equal(order.totalAmount, 36);
  assert.equal((await Product.findById(rice._id)).stock, 7);
  assert.equal(await Cart.exists({ user: customer.user._id }), null);
  assert.equal(await Order.countDocuments({ customer: customer.user._id }), 1);
  assert.equal((await firstEvent).newStock, 7);

  const retry = await checkout(customer.token, "successful-order-key-001");
  assert.equal(retry.status, 200);
  assert.equal(String((await retry.json())._id), String(order._id));
  assert.equal((await Product.findById(rice._id)).stock, 7);
  assert.equal(stockEvents.length, 1);

  const emptyUser = await makeCustomer("Empty");
  const empty = await checkout(emptyUser.token, "empty-cart-key-0001");
  assert.equal(empty.status, 400);
  assert.equal(await Order.countDocuments({ customer: emptyUser.user._id }), 0);

  const invalidUser = await makeCustomer("Invalid");
  const missingProductId = new mongoose.Types.ObjectId();
  const invalidCart = await setCart(invalidUser.user, [{ productId: missingProductId, quantity: 1 }]);
  const invalid = await checkout(invalidUser.token, "invalid-product-key-01");
  assert.equal(invalid.status, 409);
  assert.ok(await Cart.exists({ _id: invalidCart._id }));
  assert.equal(await Order.countDocuments({ customer: invalidUser.user._id }), 0);

  const shortageUser = await makeCustomer("Shortage");
  const shortage = await makeProduct("Short Milk", 1);
  const shortageCart = await setCart(shortageUser.user, [{ productId: shortage._id, quantity: 2 }]);
  const insufficient = await checkout(shortageUser.token, "insufficient-stock-key1");
  assert.equal(insufficient.status, 409);
  assert.equal((await Product.findById(shortage._id)).stock, 1);
  assert.ok(await Cart.exists({ _id: shortageCart._id }));

  // A later failing line aborts an earlier successful stock write in the same transaction.
  const rollbackUser = await makeCustomer("Rollback");
  const available = await makeProduct("Available", 5);
  const unavailable = await makeProduct("Unavailable", 0);
  const rollbackCart = await setCart(rollbackUser.user, [
    { productId: available._id, quantity: 2 },
    { productId: unavailable._id, quantity: 1 },
  ]);
  const failed = await checkout(rollbackUser.token, "rollback-order-key-001");
  assert.equal(failed.status, 409);
  assert.equal((await Product.findById(available._id)).stock, 5);
  assert.equal((await Product.findById(unavailable._id)).stock, 0);
  assert.ok(await Cart.exists({ _id: rollbackCart._id }));
  assert.equal(await Order.countDocuments({ customer: rollbackUser.user._id }), 0);
  assert.equal(stockEvents.length, 1);

  const left = await makeCustomer("RaceLeft");
  const right = await makeCustomer("RaceRight");
  const lastItem = await makeProduct("Last Item", 1);
  const leftCart = await setCart(left.user, [{ productId: lastItem._id, quantity: 1 }]);
  const rightCart = await setCart(right.user, [{ productId: lastItem._id, quantity: 1 }]);
  const raceResults = await Promise.all([
    checkout(left.token, "race-left-order-key-001"),
    checkout(right.token, "race-right-order-key-001"),
  ]);
  assert.deepEqual(raceResults.map((result) => result.status).sort(), [201, 409]);
  assert.equal((await Product.findById(lastItem._id)).stock, 0);
  assert.equal(await Order.countDocuments({ items: { $elemMatch: { product: lastItem._id } } }), 1);
  const leftCartAfterRace = await Cart.exists({ _id: leftCart._id });
  const rightCartAfterRace = await Cart.exists({ _id: rightCart._id });
  assert.equal(Boolean(leftCartAfterRace) + Boolean(rightCartAfterRace), 1);
  assert.equal(stockEvents.length, 2);

});
