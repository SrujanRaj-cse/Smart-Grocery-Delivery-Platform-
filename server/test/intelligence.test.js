import test from "node:test";
import assert from "node:assert/strict";
import {
  rankSubstitutions,
  scoreDeliveryPartner,
  optimizeStopsNearestNeighbor,
  summarizeDailyDemand,
} from "../src/services/intelligence.js";

test("substitution ranking uses matching category, in-stock status, and price proximity", () => {
  const ranked = rankSubstitutions(
    { _id: "base", category: "dairy", price: 10 },
    [
      { _id: "out", category: "dairy", price: 9, stock: 0, isActive: true },
      { _id: "match", category: "dairy", price: 11, stock: 4, isActive: true },
      { _id: "other", category: "produce", price: 10, stock: 4, isActive: true },
    ],
  );
  assert.deepEqual(ranked.map((item) => item.product._id), ["match", "other"]);
  assert.equal(ranked[0].reason, "Same category and close in price");
});

test("delivery stop optimizer chooses closest next stop and labels its distance model", () => {
  const result = optimizeStopsNearestNeighbor({ latitude: 12, longitude: 77 }, [
    { id: "far", location: { latitude: 13, longitude: 78 } },
    { id: "near", location: { latitude: 12.01, longitude: 77.01 } },
  ]);
  assert.deepEqual(result.route.map((stop) => stop.id), ["near", "far"]);
  assert.equal(result.roadRouting, false);
  assert.ok(result.totalDistanceKm > 0);
});

test("demand forecast aggregates real order quantities by day and reports sparse history", () => {
  const result = summarizeDailyDemand([
    { createdAt: new Date("2026-09-01T12:00:00Z"), items: [{ product: "p1", quantity: 2 }] },
    { createdAt: new Date("2026-09-02T12:00:00Z"), items: [{ product: "p1", quantity: 4 }] },
  ], "p1", 7);
  assert.equal(result.observedDays, 2);
  assert.equal(result.totalUnits, 6);
  assert.equal(result.averageDailyUnits, 3);
  assert.equal(result.confidence, "insufficient_history");
});

test("delivery partner score balances assigned workload and recent active orders", () => {
  const lightlyLoaded = scoreDeliveryPartner({ activeOrders: 1, deliveredToday: 2 });
  const busy = scoreDeliveryPartner({ activeOrders: 5, deliveredToday: 2 });
  assert.ok(lightlyLoaded > busy);
});
