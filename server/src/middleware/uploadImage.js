import multer from "multer";

const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

const storage = multer.memoryStorage();

const uploadImage = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const err = new Error("Only PNG/JPG/WebP images are allowed");
      err.statusCode = 400;
      return cb(err);
    }
    return cb(null, true);
  },
});

export default uploadImage;

