import mongoose from "mongoose";
import { ORDER_STATUS } from "../utils/constants.js";

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const locationSchema = new mongoose.Schema({
  type: { type: String, enum: ["Point"], required: true },
  coordinates: {
    type: [Number],
    required: true,
    validate: (coordinates) => coordinates.length === 2 && coordinates[0] >= -180 && coordinates[0] <= 180 && coordinates[1] >= -90 && coordinates[1] <= 90,
  },
}, { _id: false });

const orderSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    deliveryPartner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    items: { type: [orderItemSchema], required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.CREATED,
      index: true,
    },
    address: { type: String, required: true, trim: true },
    deliveryLocation: { type: locationSchema, default: undefined },
    checkoutKey: { type: String, select: false },
    demoSeedKey: { type: String, select: false },
  },
  { timestamps: true }
);

orderSchema.index({ customer: 1, checkoutKey: 1 }, { unique: true, partialFilterExpression: { checkoutKey: { $type: "string" } } });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ deliveryPartner: 1, createdAt: -1 });
orderSchema.index({ deliveryPartner: 1, status: 1, createdAt: 1 });
orderSchema.index({ status: 1, "items.product": 1, createdAt: -1 });
orderSchema.index({ deliveryLocation: "2dsphere" });
orderSchema.index({ demoSeedKey: 1 }, { unique: true, sparse: true });
const Order = mongoose.model("Order", orderSchema);
export default Order;
