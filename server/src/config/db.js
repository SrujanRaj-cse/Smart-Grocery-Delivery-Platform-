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
