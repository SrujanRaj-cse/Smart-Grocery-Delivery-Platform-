import mongoose from "mongoose";
import { body, query } from "express-validator";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { assistantSearch } from "../ai/groceryAssistant.js";
import { getAdminOverview, getAssignmentCandidates, getForecast, getForecasts, getProductSubstitutions, getRecommendations, optimizeStopsNearestNeighbor } from "../services/intelligence.js";
import { enqueueForecastRefresh } from "../jobs/forecastQueue.js";
import { ORDER_STATUS } from "../utils/constants.js";
import { generateStructured } from "../ai/provider.js";

export const assistantValidation = [body("message").isString().trim().isLength({ min: 1, max: 500 })];
export const forecastValidation = [query("productId").optional().isMongoId(), query("horizonDays").optional().isInt({ min: 1, max: 30 })];
export const idValidation = (field = "productId") => query(field).isMongoId();

export const assistant = async (req, res) => res.json(await assistantSearch(req.body.message));
export const recommendations = async (req, res) => res.json(await getRecommendations(req.user._id, req.query.mode, req.query.productId));
export const substitutions = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.productId)) return res.status(400).json({ message: "Invalid product id" });
  const result = await getProductSubstitutions(req.params.productId);
  if (!result) return res.status(404).json({ message: "Product not found" });
  return res.json(result);
};
export const forecast = async (req, res) => {
  const horizonDays = Number(req.query.horizonDays || 7);
  if (req.query.productId) {
    const result = await getForecast({ productId: req.query.productId, horizonDays });
    if (!result) return res.status(404).json({ message: "Product not found" });
    return res.json(result);
  }
  return res.json({ generatedAt: new Date().toISOString(), forecasts: await getForecasts({ horizonDays }) });
};
export const overview = async (_req, res) => res.json(await getAdminOverview());
export const copilot = async (_req, res) => {
  const overviewData = await getAdminOverview();
  const [activeOrders, confirmedOrders] = await Promise.all([
    Order.countDocuments({ status: { $in: [ORDER_STATUS.ASSIGNED, ORDER_STATUS.PICKED] } }),
    Order.countDocuments({ status: ORDER_STATUS.CONFIRMED }),
  ]);
  const insights = [];
  if (overviewData.lowStockProducts) insights.push(`${overviewData.lowStockProducts} products have five or fewer units in stock.`);
  if (confirmedOrders) insights.push(`${confirmedOrders} confirmed orders are awaiting a delivery assignment.`);
  if (activeOrders) insights.push(`${activeOrders} delivery orders are currently active.`);
  const fallback = { insights, recommendation: insights[0] || "No urgent inventory or delivery risks are currently visible." };
  let narrative = null;
  try {
    narrative = await generateStructured({
      system: "Summarize only these verified aggregate grocery metrics. Return JSON {insights:string[],recommendation:string}. Do not invent counts, customer details, or database actions.",
      input: JSON.stringify({ ...overviewData, activeOrders, confirmedOrders }),
      schema: (value) => Array.isArray(value.insights) && value.insights.every((item) => typeof item === "string" && item.length <= 240) && typeof value.recommendation === "string" && value.recommendation.length <= 400,
    });
  } catch { /* use the deterministic aggregate-only fallback */ }
  return res.json({ mode: narrative ? "llm_aggregate_summary" : "database-aggregate-tools", ...(narrative || fallback), metrics: overviewData });
};
export const assignmentCandidates = async (_req, res) => res.json(await getAssignmentCandidates());
export const queueForecasts = async (_req, res) => {
  const products = await Product.find({ isActive: true }).select("_id").limit(200).lean();
  const result = await enqueueForecastRefresh(products.map((product) => product._id.toString()));
  return res.status(result.queued ? 202 : 503).json(result);
};

export const deliveryRoute = async (req, res) => {
  const origin = { latitude: Number(req.query.latitude), longitude: Number(req.query.longitude) };
  if (!Number.isFinite(origin.latitude) || origin.latitude < -90 || origin.latitude > 90 || !Number.isFinite(origin.longitude) || origin.longitude < -180 || origin.longitude > 180) {
    return res.status(400).json({ message: "Provide valid latitude and longitude for the route origin" });
  }
  const orders = await Order.find({ deliveryPartner: req.user._id, status: { $in: [ORDER_STATUS.ASSIGNED, ORDER_STATUS.PICKED] } }).sort({ createdAt: 1 }).lean();
  const stops = orders.filter((order) => order.deliveryLocation?.coordinates?.length === 2).map((order) => ({
    orderId: order._id,
    address: order.address,
    status: order.status,
    location: { longitude: order.deliveryLocation.coordinates[0], latitude: order.deliveryLocation.coordinates[1] },
  }));
  return res.json({ ...optimizeStopsNearestNeighbor(origin, stops), omittedOrdersWithoutCoordinates: orders.length - stops.length, note: "Great-circle stop ordering is an approximation and does not account for roads or traffic." });
};
