import conn from "./../config/db.js";

const pool = await conn();

const normalizeFrequency = (f) => {
    if (!f) return "Monthly";
    const v = String(f).toLowerCase();
    if (v === "monthly") return "Monthly";
    if (v === "quarterly") return "Quarterly";
    if (v === "semi-annually" || v === "semiannually" || v === "semi_annually")
        return "Semi-annually";
    if (v === "annually" || v === "yearly") return "Annually";
    return "Monthly";
};

const createCharge = async (charge = {}) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        let {
            lease_id,
            charge_type,
            description,
            amount,
            charge_date,
            due_date,
            is_recurring,
            status,
            frequency,
            auto_generate_until,
            auto_gen_until,
        } = charge || {};

        const insertChargeSql = `
            INSERT INTO charges 
            (lease_id, charge_type, description, amount, charge_date, due_date, is_recurring, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [chargeResult] = await conn.query(insertChargeSql, [
            lease_id,
            charge_type,
            description,
            amount,
            charge_date,
            due_date,
            is_recurring,
            status,
        ]);
        const charge_id = chargeResult.insertId;

        let template_id = null;
        const recurringEnabled =
            is_recurring === 1 ||
            is_recurring === true ||
            is_recurring === "1" ||
            is_recurring === "true";
        if (recurringEnabled) {
            const freqEnum = normalizeFrequency(frequency);
            const autoUntil = auto_generate_until || auto_gen_until || due_date;

            const insertTemplateSql = `
                INSERT INTO recurring_templates
                (lease_id, charge_type, description, amount, frequency, next_due, auto_generate_until, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            `;
            const [tmplRes] = await conn.query(insertTemplateSql, [
                lease_id,
                charge_type,
                description,
                amount,
                freqEnum,
                due_date,
                autoUntil,
            ]);
            template_id = tmplRes.insertId;

            try {
                await conn.query(
                    `UPDATE charges SET template_id = ? WHERE charge_id = ?`,
                    [template_id, charge_id]
                );
            } catch (e) {
                throw e;
            }
        }

        await conn.commit();
        conn.release();
        return { charge_id, template_id, ...charge };
    } catch (error) {
        await conn.rollback();
        conn.release();
        console.error("Error creating charge:", error);
        throw error;
    }
};

const getAllCharges = async (queryParams = {}) => {
    try {
        const where = [];
        const values = [];

        const q = queryParams.q || queryParams.search || queryParams.term || null;
        const status = queryParams.status || null;
        const chargeType = queryParams.charge_type || queryParams.type || null;
        const dueDate = queryParams.due_date || null;
        const dueFrom = queryParams.due_date_from || null;
        const dueTo = queryParams.due_date_to || null;

        if (q) {
            const like = `%${String(q).trim()}%`;
            where.push(`(
                CONCAT(IFNULL(u.first_name,''),' ',IFNULL(u.last_name,'')) LIKE ?
                OR c.description LIKE ?
                OR p.property_name LIKE ?
            )`);
            values.push(like, like, like);
        }

        if (chargeType) {
            where.push(`LOWER(c.charge_type) = LOWER(?)`);
            values.push(chargeType);
        }

        if (dueDate) {
            where.push(`DATE(c.due_date) = ?`);
            values.push(dueDate);
        } else if (dueFrom && dueTo) {
            where.push(`DATE(c.due_date) BETWEEN ? AND ?`);
            values.push(dueFrom, dueTo);
        } else if (dueFrom) {
            where.push(`DATE(c.due_date) >= ?`);
            values.push(dueFrom);
        } else if (dueTo) {
            where.push(`DATE(c.due_date) <= ?`);
            values.push(dueTo);
        }


        const paidExpr = `IFNULL(c.total_paid, IFNULL(pay_sum.total_paid,0))`;

        const lateFeeExpr = `CASE\n                WHEN DATEDIFF(CURDATE(), DATE(c.due_date)) > IFNULL(l.grace_period_days, 0)\n                     AND IFNULL(c.total_paid, IFNULL(pay_sum.total_paid,0)) < c.amount\n                    THEN ROUND(c.amount * IFNULL(l.late_fee_percentage, 0) / 100, 2)\n                ELSE 0\n            END`;
        const effAmountExpr = `(c.amount + ${lateFeeExpr})`;

        if (status) {
            const s = String(status).toUpperCase();
            if (s === "WAIVED") {
                where.push(`c.status = 'Waived'`);
            } else if (s === "PAID") {
                where.push(`${paidExpr} >= ${effAmountExpr}`);
            } else if (s === "PARTIALLY_PAID" || s === "PARTIAL") {
                where.push(`${paidExpr} > 0 AND ${paidExpr} < ${effAmountExpr}`);
            } else if (s === "UNPAID") {
                where.push(
                    `${paidExpr} = 0 AND (c.status IS NULL OR c.status != 'Waived')`
                );
            } else if (s === "OVERDUE") {
                where.push(
                    `DATE(c.due_date) < CURDATE() AND ${paidExpr} < ${effAmountExpr} AND (c.status IS NULL OR c.status != 'Waived')`
                );
            } else if (s === "DUE-SOON" || s === "DUE_SOON") {
                where.push(
                    `DATE(c.due_date) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 3 DAY) AND ${paidExpr} < ${effAmountExpr} AND (c.status IS NULL OR c.status != 'Waived')`
                );
            } else if (s === "PENDING") {
                where.push(
                    `DATE(c.due_date) > DATE_ADD(CURDATE(), INTERVAL 3 DAY) AND ${paidExpr} < ${effAmountExpr} AND (c.status IS NULL OR c.status != 'Waived')`
                );
            } else {
                where.push(`LOWER(c.status) = ?`);
                values.push(String(status).toLowerCase());
            }
        }

        const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";


        const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 10));
        const offset = (page - 1) * limit;


        const countSql = `
            SELECT COUNT(*) AS cnt
            FROM charges c
            LEFT JOIN (
                SELECT charge_id, IFNULL(SUM(amount), 0) AS total_paid
                FROM payments
                WHERE status = 'Confirmed' OR status = 'Completed'
                GROUP BY charge_id
            ) pay_sum ON pay_sum.charge_id = c.charge_id
            LEFT JOIN leases l ON c.lease_id = l.lease_id
            LEFT JOIN users u ON l.user_id = u.user_id
            LEFT JOIN properties p ON l.property_id = p.property_id
            ${whereClause}
        `;
        const [countRows] = await pool.query(countSql, values);
        const total = Number(countRows?.[0]?.cnt || 0);

        const sql = `
        SELECT
            c.*, 
            l.lease_id,
            l.grace_period_days,
            l.late_fee_percentage,
            CONCAT(u.first_name, ' ', u.last_name, IFNULL(CONCAT(' ', u.suffix), '')) AS tenant_name,
            p.property_name,
            IFNULL(c.total_paid, IFNULL(pay_sum.total_paid, 0)) AS total_paid,
            ${effAmountExpr} AS amount,
            ${lateFeeExpr} AS late_fee_amount,
            c.amount AS original_amount,
            CASE
                WHEN c.status = 'Waived' THEN 'WAIVED'
                WHEN IFNULL(c.total_paid, IFNULL(pay_sum.total_paid, 0)) >= ${effAmountExpr} THEN 'PAID'
                WHEN IFNULL(c.total_paid, IFNULL(pay_sum.total_paid, 0)) > 0 THEN 'PARTIALLY-PAID'
                ELSE 'UNPAID'
            END AS canonical_status
        FROM charges c
        LEFT JOIN (
            SELECT charge_id, IFNULL(SUM(amount), 0) AS total_paid
            FROM payments
            WHERE status = 'Confirmed' OR status = 'Completed'
            GROUP BY charge_id
        ) pay_sum ON pay_sum.charge_id = c.charge_id
        LEFT JOIN leases l ON c.lease_id = l.lease_id
        LEFT JOIN users u ON l.user_id = u.user_id
        LEFT JOIN properties p ON l.property_id = p.property_id
        ${whereClause}
        ORDER BY c.charge_date DESC, c.due_date DESC
        LIMIT ${limit} OFFSET ${offset}
        `;

        const [rows] = await pool.query(sql, values);
        return {
            data: rows,
            total,
            page,
            limit,
        };
    } catch (error) {
        console.error("Error fetching all charges:", error);
        throw error;
    }
};

const getRecurringTemplateById = async (templateId) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM recurring_templates WHERE template_id = ?",
            [templateId]
        );
        return rows[0] || null;
    } catch (error) {
        console.error(
            `Error fetching recurring template with id ${templateId}:`,
            error
        );
        throw error;
    }
};

const updateRecurringTemplateById = async (templateId, tmpl = {}) => {
    try {
        if (!templateId) throw new Error("templateId is required");

        const fields = [];
        const values = [];

        const {
            frequency,
            amount,
            next_due,
            auto_generate_until,
            auto_gen_until,
            is_active,
            description,
            charge_type,
        } = tmpl || {};

        if (frequency !== undefined) {
            fields.push(`frequency = ?`);
            values.push(normalizeFrequency(frequency));
        }
        if (amount !== undefined) {
            fields.push(`amount = ?`);
            values.push(amount);
        }
        if (next_due !== undefined) {
            fields.push(`next_due = ?`);
            values.push(next_due);
        }
        const autoUntil =
            auto_generate_until !== undefined ? auto_generate_until : auto_gen_until;
        if (autoUntil !== undefined) {
            fields.push(`auto_generate_until = ?`);
            values.push(autoUntil);
        }
        if (is_active !== undefined) {
            fields.push(`is_active = ?`);
            values.push(is_active ? 1 : 0);
        }
        if (description !== undefined) {
            fields.push(`description = ?`);
            values.push(description);
        }
        if (charge_type !== undefined) {
            fields.push(`charge_type = ?`);
            values.push(charge_type);
        }

        if (fields.length === 0) return await getRecurringTemplateById(templateId);

        const sql = `UPDATE recurring_templates SET ${fields.join(
            ", "
        )} WHERE template_id = ?`;
        values.push(templateId);
        await pool.query(sql, values);
        return await getRecurringTemplateById(templateId);
    } catch (error) {
        console.error(
            `Error updating recurring template with id ${templateId}:`,
            error
        );
        throw error;
    }
};

const getChargeById = async (id) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM charges WHERE charge_id = ?",
            [id]
        );
        return rows[0] || null;
    } catch (error) {
        console.error(`Error fetching charge with id ${id}:`, error);
        throw error;
    }
};

const getChargeByUserId = async (userId) => {
    try {
        const query = `
        SELECT
            c.*,
            l.lease_id,
            l.grace_period_days,
            l.late_fee_percentage,
            CONCAT(u.first_name, ' ', u.last_name, IFNULL(CONCAT(' ', u.suffix), '')) AS tenant_name,
            p.property_name,
            IFNULL(c.total_paid, IFNULL(pay_sum.total_paid, 0)) AS total_paid,
            (
                c.amount + CASE
                    WHEN DATEDIFF(CURDATE(), DATE(c.due_date)) > IFNULL(l.grace_period_days, 0)
                         AND IFNULL(c.total_paid, IFNULL(pay_sum.total_paid,0)) < c.amount
                        THEN ROUND(c.amount * IFNULL(l.late_fee_percentage, 0) / 100, 2)
                    ELSE 0
                END
            ) AS amount,
            (
                CASE
                    WHEN DATEDIFF(CURDATE(), DATE(c.due_date)) > IFNULL(l.grace_period_days, 0)
                         AND IFNULL(c.total_paid, IFNULL(pay_sum.total_paid,0)) < c.amount
                        THEN ROUND(c.amount * IFNULL(l.late_fee_percentage, 0) / 100, 2)
                    ELSE 0
                END
            ) AS late_fee_amount,
            c.amount AS original_amount,
            CASE
                WHEN c.status = 'Waived' THEN 'WAIVED'
                WHEN IFNULL(c.total_paid, IFNULL(pay_sum.total_paid, 0)) >= (
                    c.amount + CASE
                        WHEN DATEDIFF(CURDATE(), DATE(c.due_date)) > IFNULL(l.grace_period_days, 0)
                             AND IFNULL(c.total_paid, IFNULL(pay_sum.total_paid,0)) < c.amount
                            THEN ROUND(c.amount * IFNULL(l.late_fee_percentage, 0) / 100, 2)
                        ELSE 0
                    END
                ) THEN 'PAID'
                WHEN IFNULL(c.total_paid, IFNULL(pay_sum.total_paid, 0)) > 0 THEN 'PARTIALLY-PAID'
                ELSE 'UNPAID'
            END AS canonical_status
        FROM charges c
        LEFT JOIN (
            SELECT charge_id, IFNULL(SUM(amount), 0) AS total_paid
            FROM payments
            WHERE status = 'Confirmed' OR status = 'Completed'
            GROUP BY charge_id
        ) pay_sum ON pay_sum.charge_id = c.charge_id
        JOIN leases l ON c.lease_id = l.lease_id
        JOIN users u ON l.user_id = u.user_id
        LEFT JOIN properties p ON l.property_id = p.property_id
        WHERE l.user_id = ?
        ORDER BY c.charge_date DESC, c.due_date DESC
        `;

        const [rows] = await pool.query(query, [userId]);
        return rows;
    } catch (error) {
        console.error(`Error fetching charges for user id ${userId}:`, error);
        throw error;
    }
};

const getChargeByLeaseId = async (leaseId, queryParams = {}) => {
    try {
        const where = [];
        const values = [];

        const dueDate = queryParams.due_date || null;
        const dueFrom = queryParams.due_date_from || null;
        const dueTo = queryParams.due_date_to || null;

        if (dueDate) {
            where.push(`DATE(c.due_date) = ?`);
            values.push(dueDate);
        } else if (dueFrom && dueTo) {
            where.push(`DATE(c.due_date) BETWEEN ? AND ?`);
            values.push(dueFrom, dueTo);
        } else if (dueFrom) {
            where.push(`DATE(c.due_date) >= ?`);
            values.push(dueFrom);
        } else if (dueTo) {
            where.push(`DATE(c.due_date) <= ?`);
            values.push(dueTo);
        }

        const extraWhere = where.length ? ` AND ${where.join(" AND ")}` : "";

        const query = `
        SELECT
            c.*,
            l.lease_id,
            l.grace_period_days,
            l.late_fee_percentage,
            CONCAT(u.first_name, ' ', u.last_name, IFNULL(CONCAT(' ', u.suffix), '')) AS tenant_name,
            p.property_name,
            IFNULL(c.total_paid, IFNULL(pay_sum.total_paid, 0)) AS total_paid,
            (
                c.amount + CASE
                    WHEN DATEDIFF(CURDATE(), DATE(c.due_date)) > IFNULL(l.grace_period_days, 0)
                         AND IFNULL(c.total_paid, IFNULL(pay_sum.total_paid,0)) < c.amount
                        THEN ROUND(c.amount * IFNULL(l.late_fee_percentage, 0) / 100, 2)
                    ELSE 0
                END
            ) AS amount,
            (
                CASE
                    WHEN DATEDIFF(CURDATE(), DATE(c.due_date)) > IFNULL(l.grace_period_days, 0)
                         AND IFNULL(c.total_paid, IFNULL(pay_sum.total_paid,0)) < c.amount
                        THEN ROUND(c.amount * IFNULL(l.late_fee_percentage, 0) / 100, 2)
                    ELSE 0
                END
            ) AS late_fee_amount,
            c.amount AS original_amount,
            CASE
                WHEN c.status = 'Waived' THEN 'WAIVED'
                WHEN IFNULL(c.total_paid, IFNULL(pay_sum.total_paid, 0)) >= (
                    c.amount + CASE
                        WHEN DATEDIFF(CURDATE(), DATE(c.due_date)) > IFNULL(l.grace_period_days, 0)
                             AND IFNULL(c.total_paid, IFNULL(pay_sum.total_paid,0)) < c.amount
                            THEN ROUND(c.amount * IFNULL(l.late_fee_percentage, 0) / 100, 2)
                        ELSE 0
                    END
                ) THEN 'PAID'
                WHEN IFNULL(c.total_paid, IFNULL(pay_sum.total_paid, 0)) > 0 THEN 'PARTIALLY-PAID'
                ELSE 'UNPAID'
            END AS canonical_status
        FROM charges c
        LEFT JOIN (
            SELECT charge_id, IFNULL(SUM(amount), 0) AS total_paid
            FROM payments
            WHERE status = 'Confirmed' OR status = 'Completed'
            GROUP BY charge_id
        ) pay_sum ON pay_sum.charge_id = c.charge_id
        JOIN leases l ON c.lease_id = l.lease_id
        JOIN users u ON l.user_id = u.user_id
        LEFT JOIN properties p ON l.property_id = p.property_id
        WHERE l.lease_id = ?${extraWhere}
        ORDER BY c.charge_date DESC, c.due_date DESC
        `;

        const [rows] = await pool.query(query, [leaseId, ...values]);
        return rows;
    } catch (error) {
        console.error(`Error fetching charges for lease id ${leaseId}:`, error);
        throw error;
    }
};


const getChargesStats = async () => {
    try {
        const sql = `
            SELECT
                COUNT(*) AS total,
                SUM(
                    CASE WHEN 
                        DATEDIFF(CURDATE(), DATE(c.due_date)) > IFNULL(l.grace_period_days, 0)
                        AND IFNULL(c.total_paid, IFNULL(pay_sum.total_paid,0)) < (
                            c.amount + CASE
                                WHEN DATEDIFF(CURDATE(), DATE(c.due_date)) > IFNULL(l.grace_period_days, 0)
                                    THEN ROUND(c.amount * IFNULL(l.late_fee_percentage, 0) / 100, 2)
                                ELSE 0
                            END
                        )
                    THEN 1 ELSE 0 END
                ) AS overdue_unsettled,
                SUM(
                    CASE WHEN 
                        DATEDIFF(DATE(c.due_date), CURDATE()) BETWEEN 0 AND 3
                        AND IFNULL(c.total_paid, IFNULL(pay_sum.total_paid,0)) < (
                            c.amount + CASE
                                WHEN DATEDIFF(CURDATE(), DATE(c.due_date)) > IFNULL(l.grace_period_days, 0)
                                    THEN ROUND(c.amount * IFNULL(l.late_fee_percentage, 0) / 100, 2)
                                ELSE 0
                            END
                        )
                    THEN 1 ELSE 0 END
                ) AS due_soon_unsettled,
                SUM(
                    CASE WHEN 
                        IFNULL(c.total_paid, IFNULL(pay_sum.total_paid,0)) < (
                            c.amount + CASE
                                WHEN DATEDIFF(CURDATE(), DATE(c.due_date)) > IFNULL(l.grace_period_days, 0)
                                    THEN ROUND(c.amount * IFNULL(l.late_fee_percentage, 0) / 100, 2)
                                ELSE 0
                            END
                        )
                        AND c.status <> 'Waived'
                    THEN 1 ELSE 0 END
                ) AS outstanding_unsettled
            FROM charges c
            LEFT JOIN (
                SELECT charge_id, IFNULL(SUM(amount), 0) AS total_paid
                FROM payments
                WHERE status = 'Confirmed' OR status = 'Completed'
                GROUP BY charge_id
            ) pay_sum ON pay_sum.charge_id = c.charge_id
            LEFT JOIN leases l ON c.lease_id = l.lease_id
        `;
        const [rows] = await pool.query(sql);
        const r = rows?.[0] || { total: 0, overdue_unsettled: 0, due_soon_unsettled: 0, outstanding_unsettled: 0 };
        return {
            total: Number(r.total || 0),
            overdue: Number(r.overdue_unsettled || 0),
            dueSoon: Number(r.due_soon_unsettled || 0),
            outstanding: Number(r.outstanding_unsettled || 0),
        };
    } catch (error) {
        console.error('Error computing charges stats:', error);
        throw error;
    }
};

const updateChargeById = async (id, charge = {}) => {
    try {
        const fields = [];
        const values = [];
        Object.entries(charge).forEach(([key, value]) => {
            fields.push(`${key} = ?`);
            values.push(value);
        });
        if (fields.length === 0) return null;
        const query = `UPDATE charges SET ${fields.join(", ")} WHERE charge_id = ?`;
        values.push(id);
        await pool.query(query, values);
        return await getChargeById(id);
    } catch (error) {
        console.error(`Error updating charge with id ${id}:`, error);
        throw error;
    }
};

const deleteChargeById = async (id) => {
    try {
        await pool.query("DELETE FROM charges WHERE charge_id = ?", [id]);
        return { deleted: true, charge_id: id };
    } catch (error) {
        console.error(`Error deleting charge with id ${id}:`, error);
        throw error;
    }
};

export default {
    createCharge,
    getAllCharges,
    getChargeById,
    getChargeByUserId,
    getChargeByLeaseId,
    updateChargeById,
    deleteChargeById,
    getRecurringTemplateById,
    updateRecurringTemplateById,
    getChargesStats,
};
