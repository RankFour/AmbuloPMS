import express from "express";
import { protect } from "../middlewares/authMiddleware.js";

import {
    createPayment,
    getAllPayments,
    getPaymentsByUserId,
    getPaymentById,
    updatePaymentById,
    deletePaymentById,
    searchPayments,
    getPaymentsStats,
    getPaymentAllocations,
} from "../controllers/paymentsControllers.js";

import createUploadMiddleware from "../middlewares/multer/uploadMiddleware.js";
import { streamInvoicePdf } from "../controllers/invoicesControllers.js";

const router = express.Router();

router.post(
    "/create-payment",
    protect,
    createUploadMiddleware({
        fields: [{ name: "proofs", maxCount: 5 }],
        fieldFolders: { proofs: "payment_proofs" },
    }),
    createPayment
);
router.get("/", protect, getAllPayments);
router.get("/stats", protect, getPaymentsStats);
router.get("/search/by-charge", protect, searchPayments);
router.get("/users/:userId", protect, getPaymentsByUserId);

router.get("/:id/invoice.pdf", protect, streamInvoicePdf);
router.get("/:id", protect, getPaymentById);
router.get("/:id/allocations", protect, getPaymentAllocations);
router.patch(
    "/:id",
    protect,
    createUploadMiddleware({
        fields: [{ name: "proofs", maxCount: 5 }],
        fieldFolders: { proofs: "payment_proofs" },
    }),
    updatePaymentById
);
router.delete("/:id", protect, deletePaymentById);

export default router;
