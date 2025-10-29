import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  getLeaseDefaults,
  updateLeaseDefaultsById,
} from "../controllers/leaseDefaultsControllers.js";

const router = express.Router();

router.get("/", protect,getLeaseDefaults);
router.patch("/:setting_id", protect, updateLeaseDefaultsById);

export default router;