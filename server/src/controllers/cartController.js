import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

const cartCount = (items) => items.reduce((sum, item) => sum + item.quantity, 0);

export const addToCart = async (req, res) => {
  const { productId, quantity } = req.body;
  const qty = Number(quantity);
  if (!qty || qty < 1) {
    return res.status(400).json({ message: "quantity must be >= 1" });
  }

  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  const cart = await Cart.findOne({ user: req.user._id });
  const existingQty = cart?.items?.find((i) => String(i.productId) === String(productId))?.quantity || 0;

  const availableToAdd = product.stock - existingQty;
  if (availableToAdd <= 0 || qty > availableToAdd) {
    return res
      .status(400)
      .json({ message: `Insufficient stock. Only ${Math.max(0, availableToAdd)} left.` });
  }

  if (!cart) {
    await Cart.create({
      user: req.user._id,
      items: [{ productId, quantity: qty }],
    });
  } else {
    const item = cart.items.find((i) => String(i.productId) === String(productId));
    if (item) item.quantity += qty;
    else cart.items.push({ productId, quantity: qty });
    await cart.save();
  }

  const populated = await Cart.findOne({ user: req.user._id }).populate("items.productId", "name price stock description imageUrl");
  const items = populated.items.map((it) => ({ product: it.productId, quantity: it.quantity }));

  return res.json({ cartCount: cartCount(items), items });
};

export const getCart = async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id }).populate("items.productId", "name price stock description imageUrl");
  const items = cart ? cart.items.map((it) => ({ product: it.productId, quantity: it.quantity })) : [];
  return res.json({ cartCount: cartCount(items), items });
};

export const removeFromCart = async (req, res) => {
  const { productId } = req.body;
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return res.json({ cartCount: 0, items: [] });

  cart.items = cart.items.filter((i) => String(i.productId) !== String(productId));
  await cart.save();

  const populated = await Cart.findOne({ user: req.user._id }).populate("items.productId", "name price stock description imageUrl");
  const items = populated ? populated.items.map((it) => ({ product: it.productId, quantity: it.quantity })) : [];

  return res.json({ cartCount: cartCount(items), items });
};

export const updateCartItemQuantity = async (req, res) => {
  const { productId, quantity } = req.body;
  const qty = Number(quantity);
  if (!qty || qty < 1) return res.status(400).json({ message: "quantity must be >= 1" });

  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) return res.status(404).json({ message: "Product not found" });

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return res.status(404).json({ message: "Cart not found" });

  const item = cart.items.find((i) => String(i.productId) === String(productId));
  if (!item) return res.status(404).json({ message: "Item not in cart" });

  if (qty > product.stock) {
    return res.status(400).json({ message: `Insufficient stock. Only ${product.stock} left.` });
  }

  item.quantity = qty;
  await cart.save();

  const populated = await Cart.findOne({ user: req.user._id }).populate("items.productId", "name price stock description imageUrl");
  const items = populated.items.map((it) => ({ product: it.productId, quantity: it.quantity }));

  return res.json({ cartCount: cartCount(items), items });
};

