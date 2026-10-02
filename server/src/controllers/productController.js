import Product from "../models/Product.js";
import { deleteImageFromGridFs, uploadImageToGridFs } from "../utils/gridfsUpload.js";
import { listProducts as findProducts } from "../services/intelligence.js";

const hasValidImageSignature = ({ buffer, mimetype }) => {
  if (mimetype === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimetype === "image/jpeg" || mimetype === "image/jpg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimetype === "image/webp") return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  return false;
};

export const listProducts = async (req, res) => {
  const products = await findProducts({
    ...req.query,
    minPrice: req.query.minPrice === undefined ? undefined : Number(req.query.minPrice),
    maxPrice: req.query.maxPrice === undefined ? undefined : Number(req.query.maxPrice),
    limit: 100,
  });
  return res.json(products);
};

export const createProduct = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Image file is required (field: image)" });
  }
  if (!hasValidImageSignature(req.file)) {
    return res.status(400).json({ message: "Image content does not match an allowed image format" });
  }

  const { name, description = "", price, stock, category = "Other", brand = "", unit = "each" } = req.body;
  const numericPrice = Number(price);
  const numericStock = Number(stock);

  const { id } = await uploadImageToGridFs({
    buffer: req.file.buffer,
    filename: req.file.originalname || "product-image",
    contentType: req.file.mimetype,
  });

  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.get("host");
  const imageUrl = `${proto}://${host}/uploads/${id}`;

  let product;
  try {
    product = await Product.create({ name, description, price: numericPrice, stock: numericStock, imageUrl, category, brand, unit });
  } catch (error) {
    await deleteImageFromGridFs(id).catch(() => {});
    throw error;
  }

  return res.status(201).json(product);
};

export const updateProduct = async (req, res) => {
  const allowedFields = new Set(["name", "description", "price", "stock", "imageUrl"]);
  const keys = Object.keys(req.body);
  if (!keys.length || keys.some((key) => !allowedFields.has(key))) {
    return res.status(400).json({ message: "Invalid or empty product update" });
  }
  const updates = Object.fromEntries(keys.map((key) => [key, req.body[key]]));
  const product = await Product.findByIdAndUpdate(req.params.id, { $set: updates }, {
    new: true,
    runValidators: true,
  });
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }
  return res.json(product);
};

export const deleteProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }
  product.isActive = false;
  await product.save();
  return res.json({ message: "Product deleted" });
};
