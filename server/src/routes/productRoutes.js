import { Router } from "express";
import { body, param, query } from "express-validator";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
} from "../controllers/productController.js";
import auth from "../middleware/auth.js";
import requireRole from "../middleware/requireRole.js";
import validateRequest from "../middleware/validateRequest.js";
import { ROLES } from "../utils/constants.js";
import uploadImage from "../middleware/uploadImage.js";
import allowFields from "../middleware/allowFields.js";

const router = Router();

const validImageUrl = (value) => {
  if (!value) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
};

router.get("/", [
  query("q").optional().trim().isLength({ min: 1, max: 100 }),
  query("category").optional().trim().isLength({ min: 1, max: 80 }),
  query("minPrice").optional().isFloat({ min: 0, max: 10000000 }),
  query("maxPrice").optional().isFloat({ min: 0, max: 10000000 }),
  query("inStock").optional().isBoolean(),
], validateRequest, listProducts);

router.post(
  "/",
  auth,
  requireRole(ROLES.ADMIN),
  uploadImage.single("image"),
  allowFields(["name", "description", "price", "stock", "category", "brand", "unit"]),
  [
    body("name").trim().isLength({ min: 1, max: 120 }),
    body("description").optional().isString().isLength({ max: 2000 }),
    body("price").isFloat({ min: 0, max: 10000000 }),
    body("stock").isInt({ min: 0, max: 10000000 }),
    body("category").optional().trim().isLength({ min: 1, max: 80 }),
    body("brand").optional().trim().isLength({ max: 80 }),
    body("unit").optional().trim().isLength({ min: 1, max: 32 }),
  ],
  validateRequest,
  createProduct
);

router.patch(
  "/:id",
  auth,
  requireRole(ROLES.ADMIN),
  allowFields(["name", "description", "price", "stock", "imageUrl", "category", "brand", "unit"]),
  [
    param("id").isMongoId(),
    body("name").optional().trim().isLength({ min: 1, max: 120 }),
    body("description").optional().isString().isLength({ max: 2000 }),
    body("price").optional().isFloat({ min: 0, max: 10000000 }),
    body("stock").optional().isInt({ min: 0, max: 10000000 }),
    body("imageUrl").optional().isString().custom(validImageUrl),
    body("category").optional().trim().isLength({ min: 1, max: 80 }),
    body("brand").optional().trim().isLength({ max: 80 }),
    body("unit").optional().trim().isLength({ min: 1, max: 32 }),
  ],
  validateRequest,
  updateProduct
);

router.delete("/:id", auth, requireRole(ROLES.ADMIN), [param("id").isMongoId()], validateRequest, deleteProduct);

export default router;
