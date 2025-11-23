import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  createLease,
  getAllLeases,
  getSingleLeaseById,
  getLeaseByUserId,
  updateLeaseById,
  deleteLeaseById,
  terminateLease,
  renewLease,
} from "../controllers/leaseControllers.js";
import createUploadMiddleware from "../middlewares/multer/uploadMiddleware.js";

const router = express.Router();

router.post(
  "/create-lease",
  createUploadMiddleware({
    fields: [{ name: "contract", maxCount: 1 }],
    fieldFolders: {
      contract: "lease_contracts",
    },
  }),
  protect,
  createLease
);

router.get("/", protect, getAllLeases);

router.get("/users/:userId", protect, getLeaseByUserId);
router.get("/:id", protect, getSingleLeaseById);

router.post("/:id/terminate", protect, terminateLease);
router.post("/:id/renew", protect, renewLease);

router.patch(
  "/:id",
  createUploadMiddleware({
    fields: [{ name: "contract", maxCount: 1 }],
    fieldFolders: {
      contract: "lease_contracts",
    },
  }),
  protect,
  updateLeaseById
);

router.delete("/:id", protect, deleteLeaseById);

export default router;
