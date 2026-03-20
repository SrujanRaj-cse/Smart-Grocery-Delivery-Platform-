import { Router } from "express";
import { body } from "express-validator";
import { login, me, register } from "../controllers/authController.js";
import auth from "../middleware/auth.js";
import validateRequest from "../middleware/validateRequest.js";

const router = Router();

router.post(
  "/register",
  [
    body("name").trim().notEmpty(),
    body("email").isEmail(),
    body("password").isLength({ min: 6 }),
  ],
  validateRequest,
  register
);

router.post(
  "/login",
  [body("email").isEmail(), body("password").notEmpty()],
  validateRequest,
  login
);

router.get("/me", auth, me);

export default router;
