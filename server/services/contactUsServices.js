import conn from "../config/db.js";
import notificationsServices from "./notificationsServices.js";

const pool = await conn();

const allowedFields = new Set([
    "first_name",
    "last_name",
    "email",
    "phone_number",
    "subject",
    "business_type",
    "preferred_space_size",
    "monthly_budget_range",
    "message",
    "status",
    "replied_at",
]);

const allowedStatuses = new Set(["pending", "responded", "archived"]);

const createContactUsEntry = async (contactData = {}, io = null) => {
    try {
        const columns = [];
        const placeholders = [];
        const values = [];

        for (const key of Array.from(allowedFields)) {
            if (!(key in contactData)) continue;
            const val = contactData[key];
            if (val === undefined) continue;
            columns.push(key);
            placeholders.push("?");
            values.push(val === null ? null : val);
        }

        if (columns.length === 0) {
            throw new Error("No valid fields provided to create contact submission");
        }

        const sql = `INSERT INTO contact_submissions (${columns.join(
            ","
        )}) VALUES (${placeholders.join(",")})`;
        const [result] = await pool.execute(sql, values);

        const insertId = result.insertId;

        const [rows] = await pool.execute(
            "SELECT * FROM contact_submissions WHERE id = ?",
            [insertId]
        );
        const inserted = rows[0] || { id: insertId };

        
        try {
            const [adminRows] = await pool.query(
                `SELECT user_id FROM users WHERE UPPER(role) IN ('ADMIN','MANAGER','STAFF') AND (status IS NULL OR status <> 'inactive')`
            );
            if (adminRows && adminRows.length) {
                for (const a of adminRows) {
                    try {
                        await notificationsServices.createNotification({
                            user_id: a.user_id,
                            type: 'INQUIRY',
                            title: 'New Contact Submission',
                            body: `${contactData.subject || 'New inquiry'} from ${contactData.first_name || ''} ${contactData.last_name || ''}`,
                            link: '/contact-us-submissions.html',
                            meta: { submission_id: inserted.id }
                        }, io);
                    } catch (e) {
                        console.warn('Failed to notify admin about contact submission', a && a.user_id, e && e.message);
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to query admin users for contact submission notifications', e && e.message);
        }

        return inserted;
    } catch (error) {
        throw new Error(error.message || "Failed to create contact us entry");
    }
};

const getAllContactUsEntries = async (options = {}) => {
    try {
        const page = parseInt(options.page, 10) || 1;
        const limit = Math.min(parseInt(options.limit, 10) || 100, 1000);
        const offset = (page - 1) * limit;

        const whereClauses = [];
        const whereParams = [];

        if (options.search && String(options.search).trim() !== "") {
            const q = `%${String(options.search).trim()}%`;
            whereClauses.push(
                "(first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR subject LIKE ? OR message LIKE ?)"
            );
            whereParams.push(q, q, q, q, q);
        }

        if (options.status && String(options.status).trim() !== "") {
            let st = String(options.status).trim().toLowerCase();

            if (st === "pending response" || st === "pending-response")
                st = "pending";

            if (st === "responded" || st === "replied" || st === "resolved")
                st = "responded";
            if (allowedStatuses.has(st)) {
                whereClauses.push("status = ?");
                whereParams.push(st);
            }
        }

        if (options.fromDate && String(options.fromDate).trim() !== "") {
            whereClauses.push("DATE(submitted_at) >= ?");
            whereParams.push(String(options.fromDate).trim());
        }
        if (options.toDate && String(options.toDate).trim() !== "") {
            whereClauses.push("DATE(submitted_at) <= ?");
            whereParams.push(String(options.toDate).trim());
        }

        let whereSQL = "";
        if (whereClauses.length > 0) {
            whereSQL = "WHERE " + whereClauses.join(" AND ");
        }

        let sortDir = "DESC";
        if (options.sort && String(options.sort).toLowerCase() === "asc")
            sortDir = "ASC";

        const sql = `SELECT * FROM contact_submissions ${whereSQL} ORDER BY submitted_at ${sortDir} LIMIT ? OFFSET ?`;
        const paramsMain = [...whereParams, limit, offset];

        const placeholderCount = (sql.match(/\?/g) || []).length;
        if (placeholderCount !== paramsMain.length) {
            throw new Error(
                `Placeholder/param mismatch for main query: placeholders=${placeholderCount} params=${paramsMain.length}`
            );
        }

        const sanitizedParamsMain = paramsMain.map((p) =>
            p === undefined
                ? null
                : typeof p === "object" && p !== null
                    ? JSON.stringify(p)
                    : p
        );
        let rows;
        try {
            const qres = await pool.query(sql, sanitizedParamsMain);
            rows = qres[0];
        } catch (dbErr) {
            const msg = `DB error on contact submissions main query: ${dbErr.message
                } -- sql=${sql} params=${JSON.stringify(sanitizedParamsMain)}`;
            console.error(msg);
            throw new Error(msg);
        }

        const countSql = `SELECT COUNT(*) as total FROM contact_submissions ${whereSQL}`;
        const countParams = [...whereParams];

        const countPlaceholders = (countSql.match(/\?/g) || []).length;
        if (countPlaceholders !== countParams.length) {
            throw new Error(
                `Placeholder/param mismatch for count query: placeholders=${countPlaceholders} params=${countParams.length}`
            );
        }

        const sanitizedCountParams = countParams.map((p) =>
            p === undefined
                ? null
                : typeof p === "object" && p !== null
                    ? JSON.stringify(p)
                    : p
        );
        let countRows;
        try {
            const cres = await pool.query(countSql, sanitizedCountParams);
            countRows = cres[0];
        } catch (dbErr) {
            const msg = `DB error on contact submissions count query: ${dbErr.message
                } -- sql=${countSql} params=${JSON.stringify(sanitizedCountParams)}`;
            console.error(msg);
            throw new Error(msg);
        }
        const total = countRows && countRows[0] ? countRows[0].total : 0;

        return { submissions: rows, total, page, limit };
    } catch (error) {
        throw new Error(error.message || "Failed to fetch contact us entries");
    }
};

const getContactUsEntryById = async (entryId) => {
    try {
        const [rows] = await pool.execute(
            "SELECT * FROM contact_submissions WHERE id = ?",
            [entryId]
        );
        return rows[0] || null;
    } catch (error) {
        throw new Error(error.message || "Failed to fetch contact us entry");
    }
};

const editContactUsEntry = async (entryId, updateData = {}) => {
    try {
        const sets = [];
        const values = [];
        for (const key of Array.from(allowedFields)) {
            if (!(key in updateData)) continue;
            const val = updateData[key];
            if (val === undefined) continue;
            sets.push(`${key} = ?`);
            values.push(val === undefined ? null : val);
        }

        if (sets.length === 0) {
            throw new Error("No valid fields provided to update");
        }

        const sql = `UPDATE contact_submissions SET ${sets.join(
            ", "
        )} WHERE id = ?`;
        values.push(entryId);

        const [result] = await pool.execute(sql, values);

        if (result.affectedRows === 0) {
            return null;
        }

        const [rows] = await pool.execute(
            "SELECT * FROM contact_submissions WHERE id = ?",
            [entryId]
        );
        return rows[0] || null;
    } catch (error) {
        throw new Error(error.message || "Failed to update contact us entry");
    }
};

const deleteContactUsEntry = async (entryId) => {
    try {
        const [result] = await pool.execute(
            "DELETE FROM contact_submissions WHERE id = ?",
            [entryId]
        );
        return { affectedRows: result.affectedRows };
    } catch (error) {
        throw new Error(error.message || "Failed to delete contact us entry");
    }
};

export default {
    createContactUsEntry,
    getAllContactUsEntries,
    getContactUsEntryById,
    editContactUsEntry,
    deleteContactUsEntry,
};
