import { Server } from "socket.io";

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
        if (!origin) return callback(null, true);
        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Socket CORS not allowed"));
      },
      credentials: true,
    },
  });

  io.on("connection", () => {
    // no-op; clients just listen for stock events
  });
};

export const emitStockUpdated = ({ productId, newStock }) => {
  if (!io) return;
  io.emit("stockUpdated", { productId, newStock });
};

