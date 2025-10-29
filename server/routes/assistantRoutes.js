import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import assistantController from "../controllers/assistantControllers.js";
import assistantChatApi from "../controllers/assistantChatApiController.js";

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


router.post("/chat/open", protect, assistantChatApi.openConversation);
router.post("/chat/send", protect, assistantChatApi.send);
router.get("/chat/messages", protect, assistantChatApi.history);

export default router;
