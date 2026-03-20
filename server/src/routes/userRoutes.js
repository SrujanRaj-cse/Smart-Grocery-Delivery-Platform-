import { Router } from "express";
import { body } from "express-validator";
import { getUsers, updateUserRole } from "../controllers/userController.js";
import auth from "../middleware/auth.js";
import requireRole from "../middleware/requireRole.js";
import validateRequest from "../middleware/validateRequest.js";
import { ROLES } from "../utils/constants.js";

const router = Router();

router.use(auth, requireRole(ROLES.ADMIN));
router.get("/", getUsers);
router.patch(
  "/:id/role",
  [body("role").isIn(Object.values(ROLES))],
  validateRequest,
  updateUserRole
);

export default router;
