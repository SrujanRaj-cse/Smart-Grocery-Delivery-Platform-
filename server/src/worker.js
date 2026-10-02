import "dotenv/config";
import mongoose from "mongoose";
import connectDb, { validateRuntimeConfig } from "./config/db.js";
import { createForecastWorker } from "./jobs/forecastWorker.js";

validateRuntimeConfig();
if (!process.env.REDIS_URL) throw new Error("REDIS_URL is required to run the forecast worker");
await connectDb();
const { worker, cacheConnection } = createForecastWorker();

worker.on("failed", (job, error) => console.error("Forecast job failed", { jobId: job?.id, message: error.message }));
console.info("Forecast worker started");

const shutdown = async () => {
  await worker.close();
  await cacheConnection.quit();
  await mongoose.disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
