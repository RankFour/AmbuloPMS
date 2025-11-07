import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import assistantController from "../controllers/assistantControllers.js";
import assistantChatApi from "../controllers/assistantChatApiController.js";
import assistantGeminiController from "../controllers/assistantGeminiController.js";
import assistantViewProxyController from "../controllers/assistantViewProxyController.js";

const router = express.Router();

router.post("/session/init", protect, assistantController.initSession);

router.get("/me/profile", protect, assistantController.getMyProfile);
router.get("/me/tickets", protect, assistantController.getMyTickets);
router.get("/me/lease", protect, assistantController.getMyLease);
router.get("/me/charges", protect, assistantController.getMyCharges);
router.get("/me/payments", protect, assistantController.getMyPayments);
router.get("/faqs", protect, assistantController.getFaqs);
router.get(
    "/me/messages/summary",
    protect,
    assistantController.getMessagesSummary
);

router.get(
    "/me/messages",
    protect,
    assistantController.getMyMessages
);
router.post(
    "/me/messages",
    protect,
    assistantController.sendMyMessage
);

// Discovery and info
router.get("/properties", protect, assistantController.listProperties);
router.get("/properties/:property_id", protect, assistantController.getProperty);
router.get("/company-details", protect, assistantController.getCompany);
router.get("/about-us", protect, assistantController.getAbout);
router.get("/me/notifications", protect, assistantController.getMyNotifications);
router.get("/invoices/by-payment/:payment_id", protect, assistantController.getInvoiceByPayment);

// Quick stats endpoints
router.get("/stats/charges", protect, assistantController.getChargesStats);
router.get("/stats/properties", protect, assistantController.getPropertiesStats);


router.get(
    "/admin/tenants",
    protect,
    assistantController.adminSearchTenants
);
router.get(
    "/admin/tickets",
    protect,
    assistantController.adminListTickets
);
router.get(
    "/admin/charges",
    protect,
    assistantController.adminSearchCharges
);
router.get(
    "/admin/payments",
    protect,
    assistantController.adminSearchPayments
);
router.get(
    "/admin/tenants/:user_id/financials",
    protect,
    assistantController.adminGetTenantFinancials
);
router.get(
    "/admin/leases/:lease_id/charges",
    protect,
    assistantController.adminGetLeaseCharges
);
router.post(
    "/admin/charges",
    protect,
    assistantController.adminCreateCharge
);
router.post(
    "/admin/payments",
    protect,
    assistantController.adminCreatePayment
);
router.put(
    "/admin/payments/:payment_id",
    protect,
    assistantController.adminUpdatePayment
);
router.delete(
    "/admin/payments/:payment_id",
    protect,
    assistantController.adminDeletePayment
);
router.put(
    "/admin/charges/:charge_id",
    protect,
    assistantController.adminUpdateCharge
);
router.post(
    "/admin/charges/:charge_id/waive",
    protect,
    assistantController.adminWaiveCharge
);

// Admin reports
router.get("/admin/reports/financial", protect, assistantController.adminReportFinancial);
router.get("/admin/reports/tenants", protect, assistantController.adminReportTenants);
router.get("/admin/reports/properties", protect, assistantController.adminReportProperties);
router.get("/admin/reports/maintenance", protect, assistantController.adminReportMaintenance);


router.post("/chat/open", protect, assistantChatApi.openConversation);
router.post("/chat/send", protect, assistantChatApi.send);
router.get("/chat/messages", protect, assistantChatApi.history);
router.post("/chat/clear", protect, assistantChatApi.clear);

// Secure inline view proxy for Cloudinary-hosted documents (lease contracts, etc.)
router.get("/view", protect, assistantViewProxyController.proxy);

// Gemini SDK utilities
router.get("/gemini/status", protect, assistantGeminiController.status);
router.post("/gemini/generate", protect, assistantGeminiController.generate);
router.post("/gemini/intent", protect, assistantGeminiController.intent);

// Botpress endpoints removed; local assistant only

export default router;
