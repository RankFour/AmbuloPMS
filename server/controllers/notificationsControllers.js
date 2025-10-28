import expressAsync from "express-async-handler";
import notificationsServices from "../services/notificationsServices.js";

const listMyNotifications = expressAsync(async (req, res) => {
    const user_id = req.user?.user_id || req.query.user_id;
    const { page, limit, unreadOnly } = req.query;
    const result = await notificationsServices.listNotifications(user_id, {
        page,
        limit,
        unreadOnly: unreadOnly === "true",
    });
    res.status(200).json(result);
});

const createNotification = expressAsync(async (req, res) => {
    const io = req.app.get("io");
    const result = await notificationsServices.createNotification(req.body, io);
    res.status(201).json(result);
});

const markNotificationRead = expressAsync(async (req, res) => {
    const user_id = req.user?.user_id || req.body.user_id;
    const { id } = req.params;
    const result = await notificationsServices.markRead(id, user_id);
    res.status(200).json(result);
});

const markAllNotificationsRead = expressAsync(async (req, res) => {
    const user_id = req.user?.user_id || req.body.user_id;
    const result = await notificationsServices.markAllRead(user_id);
    res.status(200).json(result);
});

export {
    listMyNotifications,
    createNotification,
    markNotificationRead,
    markAllNotificationsRead,
};
