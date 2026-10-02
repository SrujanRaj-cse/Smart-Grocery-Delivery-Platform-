import mongoose from "mongoose";

const connectDb = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is required");
  }
  // Help users fail fast with a clear message when placeholders are left in.
  if (
    mongoUri.includes("<username>") ||
    mongoUri.includes("<password>") ||
    mongoUri.includes("<cluster>") ||
    mongoUri.includes("<db_name>")
  ) {
    throw new Error(
      "MONGO_URI appears to still contain placeholders. Replace <username>, <password>, <cluster>, and <db_name> with real Atlas values."
    );
  }

  await mongoose.connect(mongoUri);
};

export default connectDb;

export const validateRuntimeConfig = () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be set to a random value of at least 32 characters");
  }
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required");
  }
  if (process.env.NODE_ENV === "production" && !process.env.CLIENT_URL?.split(",").some((value) => value.trim())) {
    throw new Error("CLIENT_URL must contain at least one allowed origin in production");
  }
};
