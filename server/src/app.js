import "dotenv/config";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "./middleware/rateLimit.js";
import requestId from "./middleware/requestId.js";
import { getRedisClient } from "./config/redis.js";
import authRoutes from "./routes/authRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import intelligenceRoutes from "./routes/intelligenceRoutes.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

const app = express();

const developmentOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
  throw new Error("CLIENT_URL must contain at least one allowed origin in production");
}

app.use(helmet());
app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : false);
app.use(requestId);
app.use(cors({
  origin(origin, callback) {
    if (!origin || (process.env.NODE_ENV === "production" ? allowedOrigins : [...developmentOrigins, ...allowedOrigins]).includes(origin)) {
      return callback(null, true);
    }
    return callback(Object.assign(new Error("Origin is not allowed"), { statusCode: 403, code: "CORS_ORIGIN_DENIED" }));
  },
  credentials: true,
}));
app.use(express.json({ limit: "100kb" }));
if (process.env.NODE_ENV === "production") {
  morgan.token("request-id", (req) => req.requestId);
}
app.use(morgan(process.env.NODE_ENV === "production" ? ":method :url :status :response-time ms request=:request-id" : "dev", {
  skip: (req) => req.path === "/health",
}));
app.use(rateLimit({ name: "global", windowMs: 15 * 60 * 1000, limit: 300 }));
app.use("/auth", rateLimit({ name: "auth", windowMs: 15 * 60 * 1000, limit: 30 }));

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.get("/ready", async (req, res) => {
  const checks = { mongo: mongoose.connection.readyState === 1, redis: true };
  const redis = getRedisClient();
  if (redis) {
    try {
      if (redis.status === "wait") await redis.connect();
      checks.redis = (await redis.ping()) === "PONG";
    }
    catch { checks.redis = false; }
  }
  const ready = Object.values(checks).every(Boolean);
  return res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not_ready", checks, requestId: req.requestId });
});
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/products", productRoutes);
app.use("/orders", orderRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api", intelligenceRoutes);
app.use(uploadRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
