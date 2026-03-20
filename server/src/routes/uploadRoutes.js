import { Router } from "express";
import mongoose from "mongoose";
import { GridFSBucket, ObjectId } from "mongodb";

const router = Router();

const BUCKET_NAME = process.env.GRIDFS_BUCKET_NAME || "productImages";

router.get("/uploads/:id", async (req, res) => {
  try {
    const id = new ObjectId(req.params.id);
    const db = mongoose.connection.db;
    const bucket = new GridFSBucket(db, { bucketName: BUCKET_NAME });

    const filesCollection = db.collection(`${BUCKET_NAME}.files`);
    const fileInfo = await filesCollection.findOne({ _id: id });

    if (!fileInfo) {
      return res.status(404).json({ message: "Image not found" });
    }

    const contentType =
      fileInfo.contentType ||
      fileInfo.metadata?.contentType ||
      "application/octet-stream";

    res.setHeader("Content-Type", contentType);

    const downloadStream = bucket.openDownloadStream(id);
    downloadStream.on("error", () => res.status(404).end());
    downloadStream.pipe(res);
  } catch (error) {
    return res.status(404).json({ message: "Image not found" });
  }
});

export default router;

