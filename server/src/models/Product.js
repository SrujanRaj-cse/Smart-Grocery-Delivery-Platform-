import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    category: { type: String, default: "Other", trim: true, maxlength: 80, index: true },
    brand: { type: String, default: "", trim: true, maxlength: 80 },
    unit: { type: String, default: "each", trim: true, maxlength: 32 },
    attributes: { type: Map, of: String, default: undefined },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ isActive: 1, createdAt: -1 });
productSchema.index({ isActive: 1, category: 1, price: 1 });
productSchema.index({ name: "text", description: "text", brand: "text" }, { weights: { name: 5, brand: 3, description: 1 } });

const Product = mongoose.model("Product", productSchema);
export default Product;
