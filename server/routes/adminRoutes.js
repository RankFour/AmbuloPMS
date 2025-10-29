import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { verifyPassword } from "../controllers/adminControllers.js";

const router = express.Router();

// POST /api/:version/admin/verify-password
router.post("/verify-password", protect, verifyPassword);

export default router;
