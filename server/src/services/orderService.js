import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import {
  ORDER_STATUS,
  ROLES,
  VALID_ORDER_TRANSITIONS,
} from "../utils/constants.js";
import { emitStockUpdated } from "../socket/socket.js";

export const createOrderWithStockLock = async ({ customerId, items, address }) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const normalizedItems = [];
    let totalAmount = 0;
    const stockUpdates = [];

    for (const item of items) {
      const product = await Product.findOne({ _id: item.productId, isActive: true }).session(session);
      if (!product) {
        const err = new Error("Product not found");
        err.statusCode = 400;
        throw err;
      }
      if (product.stock < item.quantity) {
        const err = new Error(`Insufficient stock for ${product.name}`);
        err.statusCode = 400;
        throw err;
      }

      product.stock -= item.quantity;
      await product.save({ session });
      stockUpdates.push({ productId: product._id.toString(), newStock: product.stock });

      normalizedItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
      });
      totalAmount += product.price * item.quantity;
    }

    // Enforce order state machine: Created -> Confirmed
    const [order] = await Order.create(
      [
        {
          customer: customerId,
          items: normalizedItems,
          totalAmount,
          address,
          status: ORDER_STATUS.CREATED,
        },
      ],
      { session }
    );

    const allowed = VALID_ORDER_TRANSITIONS[order.status] || [];
    if (!allowed.includes(ORDER_STATUS.CONFIRMED)) {
      throw new Error(`Invalid transition ${order.status} -> ${ORDER_STATUS.CONFIRMED}`);
    }

    order.status = ORDER_STATUS.CONFIRMED;
    await order.save({ session });

    await session.commitTransaction();

    // Emit after commit so all clients see the committed stock values.
    // This runs for each product decremented by the order.
    for (const upd of stockUpdates) {
      emitStockUpdated(upd);
    }

    return order;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
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
