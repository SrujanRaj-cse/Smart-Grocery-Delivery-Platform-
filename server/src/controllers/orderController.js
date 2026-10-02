import Order from "../models/Order.js";
import User from "../models/User.js";
import { createOrderWithStockLock } from "../services/orderService.js";
import { ORDER_STATUS, ROLES } from "../utils/constants.js";
import { emitOrderUpdated } from "../socket/socket.js";
import { getAssignmentCandidates } from "../services/intelligence.js";

export const createOrder = async (req, res) => {
  try {
    const checkoutKey = req.get("Idempotency-Key") || undefined;
    if (checkoutKey) {
      const existing = await Order.findOne({ customer: req.user._id, checkoutKey });
      if (existing) return res.status(200).json(existing);
    }

    const order = await createOrderWithStockLock({
      customerId: req.user._id,
      address: req.body.address,
      deliveryLocation: req.body.deliveryLocation ? {
        type: "Point",
        coordinates: [req.body.deliveryLocation.longitude, req.body.deliveryLocation.latitude],
      } : undefined,
      checkoutKey,
    });
    const responseOrder = order.toObject ? order.toObject() : { ...order };
    delete responseOrder.checkoutKey;
    emitOrderUpdated(order);
    return res.status(201).json(responseOrder);
  } catch (error) {
    if (error.code === 11000 && req.get("Idempotency-Key")) {
      const existing = await Order.findOne({ customer: req.user._id, checkoutKey: req.get("Idempotency-Key") });
      if (existing) return res.status(200).json(existing);
    }
    if (error.hasErrorLabel?.("TransientTransactionError") || error.hasErrorLabel?.("UnknownTransactionCommitResult")) {
      return res.status(503).json({ message: "Checkout could not be confirmed. Retry with the same idempotency key." });
    }
    throw error;
  }
};

export const getOrders = async (req, res) => {
  let query = {};
  if (req.user.role === ROLES.CUSTOMER) {
    query = { customer: req.user._id };
  } else if (req.user.role === ROLES.DELIVERY_PARTNER) {
    query = { deliveryPartner: req.user._id };
  } else if (req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const orders = await Order.find(query)
    .populate("customer", "name")
    .populate("deliveryPartner", "name")
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

  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: ORDER_STATUS.CONFIRMED },
    { $set: { status: ORDER_STATUS.ASSIGNED, deliveryPartner: deliveryPartnerId } },
    { new: true, runValidators: true }
  );
  if (!order) {
    const exists = await Order.exists({ _id: orderId });
    if (!exists) return res.status(404).json({ message: "Order not found" });
    return res.status(409).json({ message: "Order is no longer available for assignment" });
  }

  emitOrderUpdated(order);
  return res.json(order);
};

export const assignBestDeliveryPartner = async (req, res) => {
  const candidates = await getAssignmentCandidates();
  if (!candidates.length) return res.status(409).json({ message: "No delivery partners are available" });
  const order = await Order.findOneAndUpdate(
    { _id: req.params.orderId, status: ORDER_STATUS.CONFIRMED },
    { $set: { status: ORDER_STATUS.ASSIGNED, deliveryPartner: candidates[0].partner._id } },
    { new: true, runValidators: true },
  );
  if (!order) return res.status(409).json({ message: "Order is no longer available for assignment" });
  emitOrderUpdated(order);
  return res.json({ order, assignment: { score: candidates[0].score, activeOrders: candidates[0].activeOrders, strategy: "least-active-orders" } });
};

export const updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;
  const expectedStatus = status === ORDER_STATUS.PICKED ? ORDER_STATUS.ASSIGNED : ORDER_STATUS.PICKED;

  const order = await Order.findOneAndUpdate(
    { _id: orderId, deliveryPartner: req.user._id, status: expectedStatus },
    { $set: { status } },
    { new: true, runValidators: true }
  );
  if (!order) {
    const exists = await Order.exists({ _id: orderId });
    if (!exists) return res.status(404).json({ message: "Order not found" });
    return res.status(409).json({ message: "Order status changed or order is assigned to another partner" });
  }
  emitOrderUpdated(order);
  return res.json(order);
};
