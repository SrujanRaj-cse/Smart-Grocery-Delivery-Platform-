import app from "./app.js";
import connectDb, { validateRuntimeConfig } from "./config/db.js";
import seedAll from "./seed/seed.js";
import http from "http";
import { initSocket } from "../socket/socket.js";
import { closeRedisClient } from "./config/redis.js";
import mongoose from "mongoose";

const PORT = process.env.PORT || 5000;

const bootstrap = async () => {
  validateRuntimeConfig();
  await connectDb();
  if (process.env.SEED_ON_START === "true") {
    await seedAll();
  }
  const server = http.createServer(app);
  const socketServer = initSocket(server);
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("Shutting down", { signal });
    await new Promise((resolve) => socketServer.close(resolve));
    await closeRedisClient();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.once("SIGINT", () => shutdown("SIGINT").catch(() => process.exit(1)));
  process.once("SIGTERM", () => shutdown("SIGTERM").catch(() => process.exit(1)));
};

bootstrap().catch((error) => {
  console.error("Server startup failed", { name: error.name, message: error.message });
  process.exit(1);
});
