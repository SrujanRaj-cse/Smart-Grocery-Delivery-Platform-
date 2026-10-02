import mongoose from "mongoose";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import { ORDER_STATUS, ROLES } from "../utils/constants.js";

const terminalStatuses = [ORDER_STATUS.DELIVERED];

export const rankSubstitutions = (original, candidates) => candidates
  .filter((candidate) => candidate.isActive && candidate.stock > 0 && String(candidate._id) !== String(original._id))
  .map((product) => {
    const sameCategory = product.category?.toLowerCase() === original.category?.toLowerCase();
    const priceDistance = Math.abs(product.price - original.price) / Math.max(original.price, 1);
    return {
      product,
      score: (sameCategory ? 3 : 0) + Math.max(0, 2 - priceDistance * 4) + Math.min(product.stock, 10) / 20,
      reason: sameCategory ? "Same category and close in price" : "Available alternative",
    };
  })
  .sort((a, b) => b.score - a.score)
  .slice(0, 5);

export const summarizeDailyDemand = (orders, productId, horizonDays = 7) => {
  const buckets = new Map();
  for (const order of orders) {
    const day = new Date(order.createdAt).toISOString().slice(0, 10);
    const quantity = order.items
      .filter((item) => String(item.product?._id || item.product) === String(productId))
      .reduce((sum, item) => sum + item.quantity, 0);
    if (quantity) buckets.set(day, (buckets.get(day) || 0) + quantity);
  }
  const totalUnits = [...buckets.values()].reduce((sum, quantity) => sum + quantity, 0);
  const observedDays = buckets.size;
  const averageDailyUnits = observedDays ? Number((totalUnits / observedDays).toFixed(2)) : 0;
  return {
    method: "historical delivered-order mean",
    horizonDays,
    observedDays,
    totalUnits,
    averageDailyUnits,
    projectedUnits: Number((averageDailyUnits * horizonDays).toFixed(2)),
    confidence: observedDays >= 14 ? "moderate" : "insufficient_history",
    history: [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, units]) => ({ date, units })),
  };
};

export const scoreDeliveryPartner = ({ activeOrders, deliveredToday = 0 }) =>
  100 - Math.max(0, activeOrders) * 20 + Math.min(Math.max(0, deliveredToday), 10) * 2;

const distanceKm = (a, b) => {
  const radians = (degrees) => degrees * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export const optimizeStopsNearestNeighbor = (origin, stops) => {
  const remaining = [...stops];
  const route = [];
  let current = origin;
  let totalDistanceKm = 0;
  while (remaining.length) {
    let bestIndex = 0;
    let bestDistance = distanceKm(current, remaining[0].location);
    for (let index = 1; index < remaining.length; index += 1) {
      const distance = distanceKm(current, remaining[index].location);
      if (distance < bestDistance) { bestIndex = index; bestDistance = distance; }
    }
    const [next] = remaining.splice(bestIndex, 1);
    totalDistanceKm += bestDistance;
    route.push({ ...next, legDistanceKm: Number(bestDistance.toFixed(2)) });
    current = next.location;
  }
  return { strategy: "nearest-neighbor great-circle approximation", route, totalDistanceKm: Number(totalDistanceKm.toFixed(2)), roadRouting: false };
};

export const listProducts = async ({ q, category, minPrice, maxPrice, inStock, limit = 100 }) => {
  const filter = { isActive: true };
  if (category) filter.category = category;
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = minPrice;
    if (maxPrice !== undefined) filter.price.$lte = maxPrice;
  }
  if (inStock === "true") filter.stock = { $gt: 0 };
  if (q) filter.$text = { $search: q };
  const products = await Product.find(filter).sort(q ? { score: { $meta: "textScore" }, createdAt: -1 } : { createdAt: -1 }).limit(limit).lean();
  return products;
};

export const getRecommendations = async (customerId, mode = "personalized", sourceProductId) => {
  const customerObjectId = new mongoose.Types.ObjectId(customerId);
  const priorOrders = await Order.find({ customer: customerObjectId, status: { $in: terminalStatuses } }).select("items createdAt").sort({ createdAt: -1 }).limit(100).lean();
  const purchased = new Set(priorOrders.flatMap((order) => order.items.map((item) => String(item.product))));
  const counts = new Map();
  for (const order of priorOrders) {
    const ids = order.items.map((item) => String(item.product));
    if (sourceProductId && ids.includes(String(sourceProductId))) {
      for (const id of ids) if (id !== String(sourceProductId)) counts.set(id, (counts.get(id) || 0) + 1);
    }
  }
  if (mode === "frequently-bought-together" && sourceProductId && counts.size) {
    const products = await Product.find({ _id: { $in: [...counts.keys()] }, isActive: true, stock: { $gt: 0 } }).lean();
    return products.sort((a, b) => (counts.get(String(b._id)) || 0) - (counts.get(String(a._id)) || 0)).slice(0, 8);
  }
  const categoryIds = [...new Set(priorOrders.flatMap((order) => order.items.map((item) => item.product)))];
  const historyProducts = categoryIds.length ? await Product.find({ _id: { $in: categoryIds } }).select("category").lean() : [];
  const categories = [...new Set(historyProducts.map((product) => product.category).filter(Boolean))];
  const query = { isActive: true, stock: { $gt: 0 }, _id: { $nin: [...purchased] } };
  if (mode === "buy-again") {
    const dueIds = [...new Set(priorOrders.slice(0, 20).flatMap((order) => order.items.map((item) => item.product)))];
    if (!dueIds.length) return [];
    query._id = { $in: dueIds };
    return Product.find(query).limit(12).lean();
  }
  if (categories.length) query.category = { $in: categories };
  const products = await Product.find(query).sort({ createdAt: -1 }).limit(12).lean();
  return products;
};

export const getProductSubstitutions = async (productId) => {
  const product = await Product.findOne({ _id: productId, isActive: true }).lean();
  if (!product) return null;
  const candidates = await Product.find({ isActive: true, stock: { $gt: 0 }, category: product.category }).limit(50).lean();
  return rankSubstitutions(product, candidates);
};

export const getForecast = async ({ productId, horizonDays = 7 }) => {
  const product = await Product.findOne({ _id: productId, isActive: true }).lean();
  if (!product) return null;
  const historyStart = new Date(Date.now() - 90 * 86400000);
  const orders = await Order.find({ status: ORDER_STATUS.DELIVERED, createdAt: { $gte: historyStart }, "items.product": product._id })
    .select("items createdAt")
    .lean();
  const demand = summarizeDailyDemand(orders, product._id, horizonDays);
  return { product: { _id: product._id, name: product.name, stock: product.stock, category: product.category }, ...demand,
    reorderSuggested: demand.observedDays >= 7 && product.stock <= demand.averageDailyUnits * horizonDays };
};

export const getForecasts = async ({ horizonDays = 7, limit = 200 } = {}) => {
  const historyStart = new Date(Date.now() - 90 * 86400000);
  const [products, groupedDemand] = await Promise.all([
    Product.find({ isActive: true }).select("_id name stock category").sort({ name: 1 }).limit(limit).lean(),
    Order.aggregate([
      { $match: { status: ORDER_STATUS.DELIVERED, createdAt: { $gte: historyStart } } },
      { $unwind: "$items" },
      { $group: { _id: { productId: "$items.product", date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } } }, units: { $sum: "$items.quantity" } } },
      { $group: { _id: "$_id.productId", totalUnits: { $sum: "$units" }, days: { $push: { date: "$_id.date", units: "$units" } }, observedDays: { $sum: 1 } } },
    ]),
  ]);
  const byProduct = new Map(groupedDemand.map((row) => [String(row._id), row]));
  return products.map((product) => {
    const demand = byProduct.get(String(product._id));
    const observedDays = demand?.observedDays || 0;
    const totalUnits = demand?.totalUnits || 0;
    const averageDailyUnits = observedDays ? Number((totalUnits / observedDays).toFixed(2)) : 0;
    return {
      product,
      method: "historical delivered-order mean",
      horizonDays,
      observedDays,
      totalUnits,
      averageDailyUnits,
      projectedUnits: Number((averageDailyUnits * horizonDays).toFixed(2)),
      confidence: observedDays >= 14 ? "moderate" : "insufficient_history",
      history: (demand?.days || []).sort((a, b) => a.date.localeCompare(b.date)),
      reorderSuggested: observedDays >= 7 && product.stock <= averageDailyUnits * horizonDays,
    };
  });
};

export const getAdminOverview = async () => {
  const [orders, customers, partners, lowStock, dailyRevenue] = await Promise.all([
    Order.countDocuments(),
    User.countDocuments({ role: ROLES.CUSTOMER }),
    User.countDocuments({ role: ROLES.DELIVERY_PARTNER }),
    Product.countDocuments({ isActive: true, stock: { $lte: 5 } }),
    Order.aggregate([
      { $match: { status: ORDER_STATUS.DELIVERED, createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, revenue: { $sum: "$totalAmount" }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);
  return { orders, customers, deliveryPartners: partners, lowStockProducts: lowStock, dailyRevenue };
};

export const getAssignmentCandidates = async () => {
  const partners = await User.find({ role: ROLES.DELIVERY_PARTNER }).select("name email").lean();
  const activeStatuses = [ORDER_STATUS.ASSIGNED, ORDER_STATUS.PICKED];
  const workloads = await Order.aggregate([
    { $match: { deliveryPartner: { $in: partners.map((partner) => partner._id) }, status: { $in: activeStatuses } } },
    { $group: { _id: "$deliveryPartner", activeOrders: { $sum: 1 } } },
  ]);
  const loadById = new Map(workloads.map((row) => [String(row._id), row.activeOrders]));
  const results = partners.map((partner) => {
    const activeOrders = loadById.get(String(partner._id)) || 0;
    return { partner, activeOrders, score: scoreDeliveryPartner({ activeOrders }) };
  });
  return results.sort((a, b) => b.score - a.score);
};
