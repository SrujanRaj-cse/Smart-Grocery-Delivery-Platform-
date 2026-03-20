import Product from "../models/Product.js";
import { uploadImageToGridFs } from "../utils/gridfsUpload.js";

export const listProducts = async (req, res) => {
  const products = await Product.find({ isActive: true }).sort({ createdAt: -1 });
  return res.json(products);
};

export const createProduct = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Image file is required (field: image)" });
  }

  const { name, description = "", price, stock } = req.body;
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

  const product = await Product.create({
    name,
    description,
    price: numericPrice,
    stock: numericStock,
    imageUrl,
  });

  return res.status(201).json(product);
};

export const updateProduct = async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
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
