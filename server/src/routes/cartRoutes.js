import { Router } from "express";
import { body } from "express-validator";
import auth from "../middleware/auth.js";
import validateRequest from "../middleware/validateRequest.js";
import { addToCart, getCart, removeFromCart, updateCartItemQuantity } from "../controllers/cartController.js";

const router = Router();
router.use(auth);

router.get("/", getCart);

router.post(
  "/add",
  [
    body("productId").isMongoId(),
    body("quantity").isInt({ min: 1 }),
  ],
  validateRequest,
  addToCart
);

router.post(
  "/remove",
  [body("productId").isMongoId()],
  validateRequest,
  removeFromCart
);

router.patch(
  "/item",
  [body("productId").isMongoId(), body("quantity").isInt({ min: 1 })],
  validateRequest,
  updateCartItemQuantity
);

export default router;

