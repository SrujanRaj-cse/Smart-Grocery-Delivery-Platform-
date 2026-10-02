const allowFields = (fields) => (req, res, next) => {
  const unexpected = Object.keys(req.body || {}).filter((key) => !fields.includes(key));
  if (unexpected.length) return res.status(400).json({ message: "Request contains unsupported fields" });
  return next();
};

export default allowFields;
