import { Router } from "express";
import { body } from "express-validator";
import { login, me, register } from "../controllers/authController.js";
import auth from "../middleware/auth.js";
import validateRequest from "../middleware/validateRequest.js";
import allowFields from "../middleware/allowFields.js";

const router = Router();

router.post(
  "/register",
  allowFields(["name", "email", "password"]),
  [
    body("name").trim().isLength({ min: 1, max: 100 }),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8, max: 72 }).custom((value) => Buffer.byteLength(value, "utf8") <= 72),
  ],
  validateRequest,
  register
);

router.post(
  "/login",
  allowFields(["email", "password"]),
  [body("email").isEmail().normalizeEmail(), body("password").isLength({ min: 1, max: 72 }).custom((value) => Buffer.byteLength(value, "utf8") <= 72)],
  validateRequest,
  login
);

router.get("/me", auth, me);

export default router;
