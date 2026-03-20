import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";

const BUCKET_NAME = process.env.GRIDFS_BUCKET_NAME || "productImages";

const uploadBuffer = ({ buffer, filename, contentType }) => {
  const db = mongoose.connection.db;
  const bucket = new GridFSBucket(db, { bucketName: BUCKET_NAME });

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      metadata: { contentType },
    });

    uploadStream.on("finish", () => resolve(uploadStream.id));
    uploadStream.on("error", reject);

    uploadStream.end(buffer);
  });
};

export const uploadImageToGridFs = async ({ buffer, filename, contentType }) => {
  if (!buffer || !buffer.length) {
    throw new Error("No image file provided");
  }

  const id = await uploadBuffer({ buffer, filename, contentType });
  return { id: id.toString(), bucketName: BUCKET_NAME };
};

