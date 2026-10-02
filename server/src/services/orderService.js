import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Cart from "../models/Cart.js";
import {
  ORDER_STATUS,
  ROLES,
  VALID_ORDER_TRANSITIONS,
} from "../utils/constants.js";
import { emitStockUpdated } from "../socket/socket.js";

export const createOrderWithStockLock = async ({ customerId, address, deliveryLocation, checkoutKey }) => {
  const session = await mongoose.startSession();
  let order;
  let committedStockUpdates = [];
  try {
    await session.withTransaction(async () => {
      committedStockUpdates = [];
      if (checkoutKey) {
        const existing = await Order.findOne({ customer: customerId, checkoutKey }).session(session);
        if (existing) {
          order = existing;
          return;
        }
      }

      const cart = await Cart.findOne({ user: customerId }).session(session);
      if (!cart?.items?.length) {
        const error = new Error("Cart is empty");
        error.statusCode = 400;
        throw error;
      }

      const quantities = new Map();
      for (const item of cart.items) {
        const id = item.productId.toString();
        quantities.set(id, (quantities.get(id) || 0) + item.quantity);
      }

      const normalizedItems = [];
      let totalAmount = 0;
      for (const [productId, quantity] of quantities) {
        const product = await Product.findOne({ _id: productId, isActive: true }).session(session);
        if (!product) {
          const error = new Error("One or more cart products are no longer available");
          error.statusCode = 409;
          throw error;
        }

        const update = await Product.updateOne(
          { _id: product._id, isActive: true, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } },
          { session }
        );
        if (update.modifiedCount !== 1) {
          const error = new Error(`Insufficient stock for ${product.name}`);
          error.statusCode = 409;
          throw error;
        }

        const newStock = product.stock - quantity;
        committedStockUpdates.push({ productId: product._id.toString(), newStock });
        normalizedItems.push({ product: product._id, name: product.name, price: product.price, quantity });
        totalAmount += product.price * quantity;
      }

      const [created] = await Order.create([{
        customer: customerId,
        items: normalizedItems,
        totalAmount,
        address,
        deliveryLocation,
        checkoutKey,
        status: ORDER_STATUS.CREATED,
      }], { session });

      const allowed = VALID_ORDER_TRANSITIONS[created.status] || [];
      if (!allowed.includes(ORDER_STATUS.CONFIRMED)) {
        throw new Error(`Invalid transition ${created.status} -> ${ORDER_STATUS.CONFIRMED}`);
      }
      created.status = ORDER_STATUS.CONFIRMED;
      await created.save({ session });

      const cleared = await Cart.deleteOne({ _id: cart._id, user: customerId }, { session });
      if (cleared.deletedCount !== 1) throw new Error("Cart changed during checkout; please retry");
      order = created;
    });

    for (const update of committedStockUpdates) emitStockUpdated(update);
    return order;
  } finally {
    await session.endSession();
  }
};

export const assertValidOrderTransition = ({ order, newStatus, actorRole, actorId, deliveryPartnerId }) => {
  const allowed = VALID_ORDER_TRANSITIONS[order.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Invalid transition ${order.status} -> ${newStatus}`);
  }

  if (newStatus === ORDER_STATUS.ASSIGNED) {
    if (actorRole !== ROLES.ADMIN) {
      throw new Error("Only admin can assign delivery partners");
    }
    if (!deliveryPartnerId) {
      throw new Error("deliveryPartnerId is required for assignment");
    }
  }

  if (newStatus === ORDER_STATUS.PICKED || newStatus === ORDER_STATUS.DELIVERED) {
    if (actorRole !== ROLES.DELIVERY_PARTNER) {
      throw new Error("Only delivery partners can update this status");
    }
    if (!order.deliveryPartner || String(order.deliveryPartner) !== String(actorId)) {
      throw new Error("Order not assigned to this delivery partner");
    }
  }
};
