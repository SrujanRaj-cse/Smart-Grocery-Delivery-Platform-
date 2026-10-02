import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

let io;

const getAllowedOrigins = () => {
  const raw = process.env.CLIENT_URL || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        const allowedOrigins = getAllowedOrigins();
        const origins = process.env.NODE_ENV === "production"
          ? allowedOrigins
          : [...allowedOrigins, "http://localhost:5173", "http://127.0.0.1:5173"];
        if (!origin || origins.includes(origin)) return callback(null, true);
        return callback(new Error("Socket CORS not allowed"));
      },
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required"));
      const { userId } = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
      const user = await User.findById(userId).select("_id role");
      if (!user) return next(new Error("Authentication required"));
      socket.data.userId = user._id.toString();
      socket.data.role = user.role;
      return next();
    } catch {
      return next(new Error("Authentication required"));
    }
  });

  io.on("connection", (socket) => {
    socket.join("authenticated-clients");
    socket.join(`user:${socket.data.userId}`);
    socket.join(`role:${socket.data.role}`);
  });
  return io;
};

export const emitStockUpdated = ({ productId, newStock }) => {
  if (!io) return;
  // Stock is public catalogue data, so every authenticated client may receive it.
  io.to("authenticated-clients").emit("stockUpdated", { productId, newStock });
};

export const emitOrderUpdated = (order) => {
  if (!io || !order) return;
  const payload = {
    orderId: order._id.toString(),
    status: order.status,
    customerId: order.customer?.toString?.() || order.customer,
    deliveryPartnerId: order.deliveryPartner?.toString?.() || order.deliveryPartner || null,
    updatedAt: order.updatedAt,
  };
  if (payload.customerId) io.to(`user:${payload.customerId}`).emit("orderUpdated", payload);
  if (payload.deliveryPartnerId) io.to(`user:${payload.deliveryPartnerId}`).emit("orderUpdated", payload);
  io.to("role:admin").emit("orderUpdated", payload);
};
