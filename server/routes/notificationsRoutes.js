import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
    listMyNotifications,
    createNotification,
    markNotificationRead,
    markAllNotificationsRead,
} from "../controllers/notificationsControllers.js";

const router = express.Router();

router.get("/", protect, listMyNotifications);
router.post("/", protect, createNotification);
router.patch("/:id/read", protect, markNotificationRead);
router.patch("/read-all", protect, markAllNotificationsRead);

export default router;
