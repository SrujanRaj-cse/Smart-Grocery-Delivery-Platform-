import { Router } from "express";
import { body } from "express-validator";
import auth from "../middleware/auth.js";
import validateRequest from "../middleware/validateRequest.js";
import allowFields from "../middleware/allowFields.js";
import { addToCart, getCart, removeFromCart, updateCartItemQuantity } from "../controllers/cartController.js";

const router = Router();
router.use(auth);

router.get("/", getCart);

router.post(
  "/add",
  allowFields(["productId", "quantity"]),
  [
    body("productId").isMongoId(),
    body("quantity").isInt({ min: 1, max: 99 }),
  ],
  validateRequest,
  addToCart
);

router.post(
  "/remove",
  allowFields(["productId"]),
  [body("productId").isMongoId()],
  validateRequest,
  removeFromCart
);

router.patch(
  "/item",
  allowFields(["productId", "quantity"]),
  [body("productId").isMongoId(), body("quantity").isInt({ min: 1, max: 99 })],
  validateRequest,
  updateCartItemQuantity
);

export default router;
