import { Router } from "express";
import { body } from "express-validator";
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

const router = Router();

router.get("/", listProducts);

router.post(
  "/",
  auth,
  requireRole(ROLES.ADMIN),
  uploadImage.single("image"),
  [body("name").notEmpty(), body("price").isFloat({ min: 0 }), body("stock").isInt({ min: 0 })],
  validateRequest,
  createProduct
);

router.patch(
  "/:id",
  auth,
  requireRole(ROLES.ADMIN),
  [
    body("name").optional().notEmpty(),
    body("price").optional().isFloat({ min: 0 }),
    body("stock").optional().isInt({ min: 0 }),
  ],
  validateRequest,
  updateProduct
);

router.delete("/:id", auth, requireRole(ROLES.ADMIN), deleteProduct);

export default router;
