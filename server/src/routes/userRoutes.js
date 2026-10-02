import { Router } from "express";
import { body, param } from "express-validator";
import { getUsers, updateUserRole } from "../controllers/userController.js";
import auth from "../middleware/auth.js";
import requireRole from "../middleware/requireRole.js";
import validateRequest from "../middleware/validateRequest.js";
import allowFields from "../middleware/allowFields.js";
import { ROLES } from "../utils/constants.js";

const router = Router();

router.use(auth, requireRole(ROLES.ADMIN));
router.get("/", getUsers);
router.patch(
  "/:id/role",
  allowFields(["role"]),
  [param("id").isMongoId(), body("role").isIn(Object.values(ROLES))],
  validateRequest,
  updateUserRole
);

export default router;
