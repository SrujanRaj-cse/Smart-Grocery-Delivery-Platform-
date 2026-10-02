import { Router } from "express";
import { param, query } from "express-validator";
import auth from "../middleware/auth.js";
import requireRole from "../middleware/requireRole.js";
import validateRequest from "../middleware/validateRequest.js";
import allowFields from "../middleware/allowFields.js";
import { ROLES } from "../utils/constants.js";
import { assistant, assistantValidation, assignmentCandidates, copilot, deliveryRoute, forecast, forecastValidation, overview, queueForecasts, recommendations, substitutions } from "../controllers/intelligenceController.js";

const router = Router();
router.post("/assistant/grocery", auth, requireRole(ROLES.CUSTOMER), allowFields(["message"]), assistantValidation, validateRequest, assistant);
router.get("/recommendations", auth, requireRole(ROLES.CUSTOMER), [
  query("mode").optional().isIn(["personalized", "buy-again", "frequently-bought-together"]),
  query("productId").optional().isMongoId(),
  query("mode").custom((mode, { req }) => mode !== "frequently-bought-together" || Boolean(req.query.productId)),
], validateRequest, recommendations);
router.get("/products/:productId/substitutions", auth, requireRole(ROLES.CUSTOMER), [param("productId").isMongoId()], validateRequest, substitutions);

router.get("/admin/analytics/overview", auth, requireRole(ROLES.ADMIN), overview);
router.get("/admin/analytics/forecast", auth, requireRole(ROLES.ADMIN), forecastValidation, validateRequest, forecast);
router.post("/admin/analytics/forecast/refresh", auth, requireRole(ROLES.ADMIN), queueForecasts);
router.get("/admin/copilot", auth, requireRole(ROLES.ADMIN), copilot);
router.get("/admin/delivery/candidates", auth, requireRole(ROLES.ADMIN), assignmentCandidates);
router.get("/delivery/route", auth, requireRole(ROLES.DELIVERY_PARTNER), [query("latitude").isFloat({ min: -90, max: 90 }), query("longitude").isFloat({ min: -180, max: 180 })], validateRequest, deliveryRoute);

export default router;
