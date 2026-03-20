import Order from "../models/Order.js";
import User from "../models/User.js";
import Cart from "../models/Cart.js";
import {
  assertValidOrderTransition,
  createOrderWithStockLock,
} from "../services/orderService.js";
import { ORDER_STATUS, ROLES } from "../utils/constants.js";

export const createOrder = async (req, res) => {
  try {
    const order = await createOrderWithStockLock({
      customerId: req.user._id,
      items: req.body.items,
      address: req.body.address,
    });

    // Clear cart after a successful checkout so frontend sync stays consistent.
    await Cart.deleteOne({ user: req.user._id });

    return res.status(201).json(order);
  } catch (error) {
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({ message: error.message || "Checkout failed" });
  }
};

export const getOrders = async (req, res) => {
  let query = {};
  if (req.user.role === ROLES.CUSTOMER) {
    query = { customer: req.user._id };
  } else if (req.user.role === ROLES.DELIVERY_PARTNER) {
    query = { deliveryPartner: req.user._id };
  }

  const orders = await Order.find(query)
    .populate("customer", "name email")
    .populate("deliveryPartner", "name email")
    .sort({ createdAt: -1 });
  return res.json(orders);
};

export const assignDeliveryPartner = async (req, res) => {
  const { orderId } = req.params;
  const { deliveryPartnerId } = req.body;

  const partner = await User.findById(deliveryPartnerId);
  if (!partner || partner.role !== ROLES.DELIVERY_PARTNER) {
    return res.status(400).json({ message: "Invalid delivery partner" });
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  try {
    assertValidOrderTransition({
      order,
      newStatus: ORDER_STATUS.ASSIGNED,
      actorRole: req.user.role,
      actorId: req.user._id,
      deliveryPartnerId,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  order.status = ORDER_STATUS.ASSIGNED;
  order.deliveryPartner = deliveryPartnerId;
  await order.save();

  return res.json(order);
};

export const updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  try {
    assertValidOrderTransition({
      order,
      newStatus: status,
      actorRole: req.user.role,
      actorId: req.user._id,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  order.status = status;
  await order.save();
  return res.json(order);
};
