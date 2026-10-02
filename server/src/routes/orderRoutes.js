import { Router } from "express";
import { body, header, param } from "express-validator";
import {
  assignDeliveryPartner,
  assignBestDeliveryPartner,
  createOrder,
  getOrders,
  updateOrderStatus,
} from "../controllers/orderController.js";
import auth from "../middleware/auth.js";
import requireRole from "../middleware/requireRole.js";
import validateRequest from "../middleware/validateRequest.js";
import allowFields from "../middleware/allowFields.js";
import { ORDER_STATUS, ROLES } from "../utils/constants.js";

const router = Router();
router.use(auth);

router.post(
  "/",
  requireRole(ROLES.CUSTOMER),
  allowFields(["address", "items", "deliveryLocation"]),
  [
    body("address").trim().isLength({ min: 1, max: 500 }),
    body("items").optional().isArray({ min: 1, max: 50 }),
    body("items.*.productId").optional().isMongoId(),
    body("items.*.quantity").optional().isInt({ min: 1, max: 99 }),
    header("Idempotency-Key").optional().isLength({ min: 8, max: 128 }).matches(/^[A-Za-z0-9._:-]+$/),
    body("deliveryLocation").optional().custom((value) => value && Number.isFinite(value.latitude) && value.latitude >= -90 && value.latitude <= 90 && Number.isFinite(value.longitude) && value.longitude >= -180 && value.longitude <= 180),
  ],
  validateRequest,
  createOrder
);

router.get("/", getOrders);

router.patch(
  "/:orderId/assign",
  requireRole(ROLES.ADMIN),
  allowFields(["deliveryPartnerId"]),
  [param("orderId").isMongoId(), body("deliveryPartnerId").isMongoId()],
  validateRequest,
  assignDeliveryPartner
);

router.post("/:orderId/assign-best", requireRole(ROLES.ADMIN), [param("orderId").isMongoId()], validateRequest, assignBestDeliveryPartner);

router.patch(
  "/:orderId/status",
  requireRole(ROLES.DELIVERY_PARTNER),
  allowFields(["status"]),
  [param("orderId").isMongoId(), body("status").isIn([ORDER_STATUS.PICKED, ORDER_STATUS.DELIVERED])],
  validateRequest,
  updateOrderStatus
);

export default router;
