import conn from "../config/db.js";
import notificationsServices from "./notificationsServices.js";

const poolPromise = conn();

const REMINDER_TYPES = {
  UPCOMING: "UPCOMING_7_DAYS",
  DUE_TODAY: "DUE_TODAY",
  AFTER_GRACE: "AFTER_GRACE",
};

async function _hasNotificationToday(user_id, charge_id, reminderKey) {
  const pool = await poolPromise;
  const [rows] = await pool.query(
    `SELECT COUNT(*) as cnt
     FROM notifications
     WHERE user_id = ?
       AND DATE(created_at) = CURDATE()
       AND (
         (JSON_VALID(meta) AND JSON_EXTRACT(meta, '$.charge_id') = CAST(? AS JSON) AND JSON_EXTRACT(meta, '$.reminder') = JSON_QUOTE(?))
         OR (meta LIKE CONCAT('%"charge_id":', ?, '%') AND meta LIKE CONCAT('%"reminder":"', ?, '"%'))
       )
    `,
    [user_id, String(charge_id), reminderKey, String(charge_id), reminderKey]
  );
  return (rows?.[0]?.cnt || 0) > 0;
}

async function _createReminder(io, user_id, charge, reminderKey) {
  const meta = {
    charge_id: charge.charge_id,
    lease_id: charge.lease_id,
    reminder: reminderKey,
    due_date: charge.due_date,
    grace_period_days: charge.grace_period_days,
  };
  let title = "";
  let body = "";
  if (reminderKey === REMINDER_TYPES.UPCOMING) {
    title = "Upcoming charge due in 7 days";
    body = `Your ${charge.charge_type?.toLowerCase() || 'charge'} of ₱${Number(charge.amount).toFixed(2)} is due on ${new Date(charge.due_date).toLocaleDateString()}.`;
  } else if (reminderKey === REMINDER_TYPES.DUE_TODAY) {
    title = "Charge due today";
    body = `Your ${charge.charge_type?.toLowerCase() || 'charge'} of ₱${Number(charge.amount).toFixed(2)} is due today.`;
  } else if (reminderKey === REMINDER_TYPES.AFTER_GRACE) {
    title = "Charge overdue after grace period";
    body = `Your ${charge.charge_type?.toLowerCase() || 'charge'} of ₱${Number(charge.amount).toFixed(2)} is past the grace period.`;
  }
  try {
    await notificationsServices.createNotification(
      {
        user_id,
        type: "PAYMENT",
        title,
        body,
        link: "/payments",
        meta,
      },
      io
    );
  } catch (e) {
    console.error("Failed to create reminder notification", e?.message || e);
  }
}

async function _runChargeRemindersOnce(io) {
  const pool = await poolPromise;
  const baseSelect = `
    SELECT c.charge_id, c.lease_id, c.charge_type, c.amount, c.due_date, c.status,
           l.user_id, l.grace_period_days
    FROM charges c
    JOIN leases l ON l.lease_id = c.lease_id
    WHERE c.status IN ('Unpaid', 'Partially Paid')
  `;

  
  const [upcoming] = await pool.query(
    `${baseSelect} AND DATEDIFF(c.due_date, CURDATE()) = 7`
  );
  for (const row of upcoming) {
    const exists = await _hasNotificationToday(row.user_id, row.charge_id, REMINDER_TYPES.UPCOMING);
    if (!exists) await _createReminder(io, row.user_id, row, REMINDER_TYPES.UPCOMING);
  }

  
  const [dueToday] = await pool.query(
    `${baseSelect} AND DATEDIFF(c.due_date, CURDATE()) = 0`
  );
  for (const row of dueToday) {
    const exists = await _hasNotificationToday(row.user_id, row.charge_id, REMINDER_TYPES.DUE_TODAY);
    if (!exists) await _createReminder(io, row.user_id, row, REMINDER_TYPES.DUE_TODAY);
  }

  
  const [afterGrace] = await pool.query(
    `${baseSelect} AND DATEDIFF(CURDATE(), c.due_date) = l.grace_period_days`
  );
  for (const row of afterGrace) {
    const exists = await _hasNotificationToday(row.user_id, row.charge_id, REMINDER_TYPES.AFTER_GRACE);
    if (!exists) await _createReminder(io, row.user_id, row, REMINDER_TYPES.AFTER_GRACE);
  }
}

export function startChargeReminderJob(app) {
  try {
    const io = app.get('io');
    if (!io) {
      console.warn('Socket.IO not initialized yet; charge reminders will start once available.');
    }

    setTimeout(() => _runChargeRemindersOnce(app.get('io')), 10_000);

    const SIX_HOURS = 6 * 60 * 60 * 1000;
    setInterval(() => {
      _runChargeRemindersOnce(app.get('io'));
    }, SIX_HOURS);
  } catch (e) {
    console.error('Failed to start charge reminder job', e);
  }
}

export default {
  startChargeReminderJob,
};
