import app from "./app.js";
import connectDb from "./config/db.js";
import seedAll from "./seed/seed.js";
import http from "http";
import { initSocket } from "../socket/socket.js";

const PORT = process.env.PORT || 5000;

const bootstrap = async () => {
  await connectDb();
  if (process.env.SEED_ON_START === "true") {
    await seedAll();
  }
  const server = http.createServer(app);
  initSocket(server);
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

bootstrap().catch((error) => {
  console.error("❌ Failed to start server:");
  console.error(error);   // <-- ADD THIS
  process.exit(1);
});
