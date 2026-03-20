import { Router } from "express";
import { body } from "express-validator";
import {
  assignDeliveryPartner,
  createOrder,
  getOrders,
  updateOrderStatus,
} from "../controllers/orderController.js";
import auth from "../middleware/auth.js";
import requireRole from "../middleware/requireRole.js";
import validateRequest from "../middleware/validateRequest.js";
import { ORDER_STATUS, ROLES } from "../utils/constants.js";

const router = Router();
router.use(auth);

router.post(
  "/",
  requireRole(ROLES.CUSTOMER),
  [
    body("address").notEmpty(),
    body("items").isArray({ min: 1 }),
    body("items.*.productId").isString().notEmpty(),
    body("items.*.quantity").isInt({ min: 1 }),
  ],
  validateRequest,
  createOrder
);

router.get("/", getOrders);

router.patch(
  "/:orderId/assign",
  requireRole(ROLES.ADMIN),
  [body("deliveryPartnerId").isString().notEmpty()],
  validateRequest,
  assignDeliveryPartner
);

router.patch(
  "/:orderId/status",
  requireRole(ROLES.DELIVERY_PARTNER),
  [body("status").isIn([ORDER_STATUS.PICKED, ORDER_STATUS.DELIVERED])],
  validateRequest,
  updateOrderStatus
);

export default router;
