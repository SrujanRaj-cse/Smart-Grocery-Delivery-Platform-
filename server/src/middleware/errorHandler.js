const notFound = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
};

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";

  // Normalize common multer errors to 400.
  if (err && err.code === "LIMIT_FILE_SIZE") {
    statusCode = 400;
    message = "Image file is too large (max 2MB).";
  }
  if (err && err.name === "MulterError") {
    statusCode = 400;
  }

  return res.status(statusCode).json({
    message,
  });
};

export { notFound, errorHandler };
