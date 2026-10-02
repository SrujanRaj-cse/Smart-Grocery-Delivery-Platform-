const notFound = (req, res) => {
  res.status(404).json({ message: "Route not found" });
};

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  let statusCode = err.statusCode || 500;
  let message = statusCode < 500 ? (err.message || "Request failed") : "Internal server error";

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation failed";
  } else if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid identifier";
  } else if (err.code === 11000) {
    statusCode = 409;
    message = "A record with these details already exists";
  } else if (err.type === "entity.too.large") {
    statusCode = 413;
    message = "Request body is too large";
  } else if (err.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Malformed JSON request body";
  }

  // Normalize common multer errors to 400.
  if (err && err.code === "LIMIT_FILE_SIZE") {
    statusCode = 400;
    message = "Image file is too large (max 2MB).";
  }
  if (err && err.name === "MulterError") {
    statusCode = 400;
    message = "Invalid image upload";
  }

  if (statusCode >= 500) {
    console.error("Request failed", { name: err.name, code: err.code, path: req.path, requestId: req.requestId });
  }

  return res.status(statusCode).json({
    message,
    ...(req.requestId ? { requestId: req.requestId } : {}),
  });
};

export { notFound, errorHandler };
