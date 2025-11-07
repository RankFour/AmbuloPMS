import conn from "./../config/db.js";
import { emitToUser } from "../config/socket.js";

const pool = await conn();

const shapeNotification = (row) => ({
    notification_id: row.notification_id,
    user_id: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    meta: (function () {
        try {
            return row.meta ? JSON.parse(row.meta) : null;
        } catch {
            return row.meta;
        }
    })(),
    is_read: !!row.is_read,
    created_at: row.created_at,
});

const createNotification = async (data = {}, io = null) => {
    const {
        user_id,
        type = "INFO",
        title,
        body = null,
        link = null,
        meta = null,
    } = data || {};
    if (!user_id || !title) throw new Error("user_id and title are required");

    try {
        const [userRows] = await pool.query(
            `SELECT user_id FROM users WHERE user_id = ? LIMIT 1`,
            [user_id]
        );
        if (!userRows || userRows.length === 0) {
            throw new Error(`Target user_id not found: ${user_id}`);
        }
    } catch (err) {
        throw new Error(`Invalid notification recipient: ${err.message}`);
    }
    const [result] = await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, link, meta) VALUES (?, ?, ?, ?, ?, ?)`,
        [
            user_id,
            String(type || "INFO").toUpperCase(),
            title,
            body,
            link,
            meta ? JSON.stringify(meta) : null,
        ]
    );
    const [rows] = await pool.query(
        `SELECT * FROM notifications WHERE notification_id = ?`,
        [result.insertId]
    );
    const notification = shapeNotification(rows[0]);
    if (io) emitToUser(io, user_id, "notification", notification);
    return { message: "Notification created", data: notification };
};

const listNotifications = async (user_id, opts = {}) => {
    if (!user_id) throw new Error("user_id is required");
    const { page = 1, limit = 10, unreadOnly = false } = opts;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = `SELECT * FROM notifications WHERE user_id = ?`;
    const params = [user_id];
    if (unreadOnly) {
        sql += " AND is_read = 0";
    }
    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await pool.query(sql, params);
    const [countRows] = await pool.query(
        `SELECT COUNT(*) as total FROM notifications WHERE user_id = ?${unreadOnly ? " AND is_read = 0" : ""
        }`,
        [user_id]
    );
    return {
        notifications: rows.map(shapeNotification),
        pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(countRows[0].total / limit),
            total: countRows[0].total,
            hasNextPage: page * limit < countRows[0].total,
            hasPrevPage: page > 1,
        },
    };
};

const markRead = async (notification_id, user_id) => {
    if (!notification_id || !user_id)
        throw new Error("notification_id and user_id are required");
    const [res] = await pool.query(
        `UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?`,
        [notification_id, user_id]
    );
    return { updated: res.affectedRows > 0 };
};

const markAllRead = async (user_id) => {
    if (!user_id) throw new Error("user_id is required");
    const [res] = await pool.query(
        `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
        [user_id]
    );
    return { updated: res.affectedRows };
};

export default {
    createNotification,
    listNotifications,
    markRead,
    markAllRead,
};
