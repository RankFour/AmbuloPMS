import conn from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import notificationsServices from "./notificationsServices.js";

const pool = await conn();

const computeAndSetChargeStatus = async (
    connHandle,
    chargeId,
    performedBy = null
) => {
    if (!chargeId) return;

    const [sumRows] = await connHandle.execute(
        `SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE charge_id = ? AND (status = 'Confirmed' OR status = 'Completed')`,
        [chargeId]
    );
    const totalPaid = sumRows && sumRows.length ? Number(sumRows[0].total_paid) : 0;

    const [chargeRows] = await connHandle.execute(
        `SELECT amount FROM charges WHERE charge_id = ? LIMIT 1`,
        [chargeId]
    );
    if (!chargeRows || !chargeRows.length) return;

    const chargeAmount = Number(chargeRows[0].amount || 0);
    let newStatus = "Unpaid";
    if (totalPaid <= 0) newStatus = "Unpaid";
    else if (chargeAmount > 0 && totalPaid >= chargeAmount) newStatus = "Paid";
    else newStatus = "Partially Paid";

    const [prevRows] = await connHandle.execute(
        `SELECT status, IFNULL(total_paid, 0) AS total_paid FROM charges WHERE charge_id = ? LIMIT 1`,
        [chargeId]
    );
    const prevStatus = prevRows && prevRows.length ? prevRows[0].status : null;
    const prevTotalPaid = prevRows && prevRows.length ? Number(prevRows[0].total_paid || 0) : 0;

    await connHandle.execute(
        `UPDATE charges SET status = ?, total_paid = ? WHERE charge_id = ?`,
        [newStatus, totalPaid, chargeId]
    );

    if (prevStatus !== newStatus || prevTotalPaid !== totalPaid) {
        try {
            await connHandle.execute(
                `INSERT INTO charge_status_audit (charge_id, old_status, new_status, old_total_paid, new_total_paid, performed_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    chargeId,
                    prevStatus,
                    newStatus,
                    prevTotalPaid,
                    totalPaid,
                    performedBy || null,
                    new Date(),
                ]
            );
        } catch (err) {
            console.error("Failed to write charge_status_audit:", err);
        }
    }
};

const createPayment = async (paymentData = {}, performedBy = null) => {
    const {
        chargeId,
        paymentDate,
        amountPaid,
        paymentMethod,
        notes,
        proofs,
        user_id,
    } = paymentData || {};

    const paymentId = uuidv4();
    const createdAt = new Date();

    const connHandle = await pool.getConnection();
    try {
        await connHandle.beginTransaction();

        const rawStatus = (paymentData.status && String(paymentData.status)) || "Pending";
        const status = rawStatus && rawStatus.toLowerCase() === "confirmed" ? "Confirmed" : rawStatus;
        const userId = user_id || performedBy || null;
        const confirmedBy = status === "Confirmed" ? user_id || null : null;
        const confirmedAt = status === "Confirmed" ? createdAt : null;

        const insertPayment = `
            INSERT INTO payments (payment_id, charge_id, user_id, amount, payment_method, status, notes, confirmed_by, confirmed_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await connHandle.execute(insertPayment, [
            paymentId,
            chargeId || null,
            userId,
            amountPaid || 0,
            paymentMethod || null,
            status,
            notes || null,
            confirmedBy,
            confirmedAt,
            createdAt,
        ]);

        if (proofs && Array.isArray(proofs) && proofs.length) {
            const insertProof = `INSERT INTO payment_proof (payment_id, proof_url, uploaded_at) VALUES (?, ?, ?)`;
            for (const url of proofs) {
                await connHandle.execute(insertProof, [paymentId, String(url), createdAt]);
            }
        }

        try {
            await connHandle.execute(
                `INSERT INTO payment_audit (payment_id, action, payload, performed_by, created_at) VALUES (?, ?, ?, ?, ?)`,
                [
                    paymentId,
                    "create",
                    JSON.stringify({ chargeId, amount: amountPaid, paymentMethod, notes, proofs, status, confirmed_by: confirmedBy, confirmed_at: confirmedAt }),
                    performedBy || null,
                    createdAt,
                ]
            );
        } catch (err) {
            console.error("Failed to write payment_audit (create):", err);
        }

        await computeAndSetChargeStatus(connHandle, chargeId, performedBy);
        await connHandle.commit();
        return { message: "Payment created successfully", payment_id: paymentId };
    } catch (error) {
        await connHandle.rollback();
        console.error("Error in createPayment:", error);
        throw error;
    } finally {
        connHandle.release();
    }
};

const getAllPayments = async (filters = {}) => {
    try {
        const { status, payment_method, payment_type, month, q } = filters || {};
        const pageNum = Math.max(1, parseInt(filters.page, 10) || 1);
        const pageLimit = Math.max(1, Math.min(100, parseInt(filters.limit, 10) || 10));
        const offset = (pageNum - 1) * pageLimit;

        const baseFrom = `
            FROM payments pay
            LEFT JOIN charges c ON pay.charge_id = c.charge_id
            LEFT JOIN leases l ON c.lease_id = l.lease_id
            LEFT JOIN users u ON l.user_id = u.user_id
            LEFT JOIN users cb ON pay.confirmed_by = cb.user_id
            LEFT JOIN properties p ON l.property_id = p.property_id
        `;
    const whereClauses = [];
    const params = [];

        if (status) {
            const s = String(status).toLowerCase();
            if (s === "confirmed") {
                whereClauses.push("(pay.status = 'Confirmed' OR pay.status = 'Completed')");
            } else {
                whereClauses.push("pay.status = ?");
                params.push(status);
            }
        }
        
        if (payment_method) {
            whereClauses.push(`LOWER(pay.payment_method) = LOWER(?)`);
            params.push(payment_method);
        }

        
        if (payment_type) {
            whereClauses.push(`LOWER(c.charge_type) = LOWER(?)`);
            params.push(payment_type);
        }

        
        if (month) {
            whereClauses.push(`DATE_FORMAT(pay.created_at, '%Y-%m') = ?`);
            params.push(month);
        }

        
        if (q) {
            whereClauses.push(`(
                CONCAT(u.first_name, ' ', u.last_name, ' ', IFNULL(u.suffix, '')) LIKE ? OR
                p.property_name LIKE ? OR
                c.description LIKE ? OR
                pay.payment_id LIKE ?
            )`);
            const like = `%${q}%`;
            params.push(like, like, like, like);
        }

        const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

        const countSql = `SELECT COUNT(*) AS cnt ${baseFrom} ${whereSql}`;
        const [countRows] = await pool.execute(countSql, params);
        const total = countRows && countRows.length ? Number(countRows[0].cnt || 0) : 0;

        const dataSql = `
            SELECT 
                pay.payment_id,
                pay.charge_id,
                pay.status,
                pay.payment_method,
                pay.notes,
                pay.amount AS amount_paid,
                pay.created_at,
                pay.confirmed_by AS processed_by,
                pay.confirmed_at AS processed_at,
                CONCAT(cb.first_name, ' ', cb.last_name) AS processed_by_name,
                CONCAT(u.first_name, ' ', u.last_name, ' ', u.suffix) AS tenant_name,
                c.description AS charge_description,
                c.charge_type AS charge_type,
                c.due_date AS due_date,
                p.property_name
            ${baseFrom}
            ${whereSql}
            ORDER BY pay.created_at DESC
            LIMIT ${pageLimit} OFFSET ${offset}
        `;
        const [rows] = await pool.execute(dataSql, params);

        (rows || []).forEach((r) => { if (r.status === "Completed") r.status = "Confirmed"; });

        if (!rows || !rows.length) {
            return { rows: rows || [], total, page: pageNum, limit: pageLimit, totalPages: Math.ceil(total / pageLimit) };
        }
        const ids = rows.map((r) => r.payment_id);
        const placeholders = ids.map(() => "?").join(",");
        const [proofRows] = await pool.execute(
            `SELECT payment_id, proof_url FROM payment_proof WHERE payment_id IN (${placeholders}) ORDER BY uploaded_at`,
            ids
        );
        const proofsMap = new Map();
        (proofRows || []).forEach((pr) => {
            if (!proofsMap.has(pr.payment_id)) proofsMap.set(pr.payment_id, []);
            proofsMap.get(pr.payment_id).push({ proof_url: pr.proof_url });
        });
        rows.forEach((r) => { r.proofs = proofsMap.get(r.payment_id) || []; });

        return { rows, total, page: pageNum, limit: pageLimit, totalPages: Math.ceil(total / pageLimit) };
    } catch (error) {
        console.error("Error in getAllPayments:", error);
        throw error;
    }
};

const getPaymentsByUserId = async (userId, { page = 1, limit = 10 } = {}) => {
    if (!userId) return { rows: [], total: 0, page: 1, limit, totalPages: 0 };
    try {
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const pageLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
        const offset = (pageNum - 1) * pageLimit;

        const countQuery = `
            SELECT COUNT(*) AS cnt
            FROM payments pay
            LEFT JOIN charges c ON pay.charge_id = c.charge_id
            LEFT JOIN leases l ON c.lease_id = l.lease_id
            WHERE (pay.user_id = ? OR l.user_id = ?)
        `;
        const [countRows] = await pool.execute(countQuery, [userId, userId]);
        const total = countRows && countRows.length ? Number(countRows[0].cnt || 0) : 0;

        const query = `
            SELECT 
                pay.payment_id,
                pay.charge_id,
                pay.status,
                pay.payment_method,
                pay.notes,
                pay.amount AS amount_paid,
                pay.created_at,
                pay.confirmed_by AS processed_by,
                pay.confirmed_at AS processed_at,
                CONCAT(cb.first_name, ' ', cb.last_name) AS processed_by_name,
                CONCAT(u.first_name, ' ', u.last_name) AS tenant_name,
                c.description AS charge_description,
                c.charge_type AS charge_type,
                c.due_date AS due_date,
                p.property_name
            FROM payments pay
            LEFT JOIN charges c ON pay.charge_id = c.charge_id
            LEFT JOIN leases l ON c.lease_id = l.lease_id
            LEFT JOIN users u ON l.user_id = u.user_id
            LEFT JOIN users cb ON pay.confirmed_by = cb.user_id
            LEFT JOIN properties p ON l.property_id = p.property_id
            WHERE (pay.user_id = ? OR l.user_id = ?)
            ORDER BY pay.created_at DESC
            LIMIT ${pageLimit} OFFSET ${offset}
        `;
        const [rows] = await pool.execute(query, [userId, userId]);

        (rows || []).forEach((r) => { if (r.status === "Completed") r.status = "Confirmed"; });

        if (!rows || !rows.length) {
            return { rows: rows || [], total, page: pageNum, limit: pageLimit, totalPages: Math.ceil(total / pageLimit) };
        }
        const ids = rows.map((r) => r.payment_id);
        const placeholders = ids.map(() => "?").join(",");
        const [proofRows] = await pool.execute(
            `SELECT payment_id, proof_url FROM payment_proof WHERE payment_id IN (${placeholders}) ORDER BY uploaded_at`,
            ids
        );
        const proofsMap = new Map();
        (proofRows || []).forEach((pr) => {
            if (!proofsMap.has(pr.payment_id)) proofsMap.set(pr.payment_id, []);
            proofsMap.get(pr.payment_id).push({ proof_url: pr.proof_url });
        });
        rows.forEach((r) => { r.proofs = proofsMap.get(r.payment_id) || []; });

        return { rows, total, page: pageNum, limit: pageLimit, totalPages: Math.ceil(total / pageLimit) };
    } catch (error) {
        console.error("Error in getPaymentsByUserId:", error);
        throw error;
    }
};

const getPaymentById = async (id) => {
    try {
        const query = `
            SELECT 
                pay.payment_id,
                pay.charge_id,
                DATE_FORMAT(pay.created_at, '%Y-%m-%d') AS payment_date,
                pay.amount AS amount_paid,
                pay.payment_method,
                pay.notes,
                CONCAT(u.first_name, ' ', u.last_name) AS full_name,
                p.property_name
            FROM payments pay
            LEFT JOIN charges c ON pay.charge_id = c.charge_id
            LEFT JOIN leases l ON c.lease_id = l.lease_id
            LEFT JOIN properties p ON l.property_id = p.property_id
            LEFT JOIN users u ON l.user_id = u.user_id
            WHERE pay.payment_id = ?
            LIMIT 1
        `;
        const [rows] = await pool.execute(query, [id]);
        const payment = rows && rows.length ? rows[0] : null;

        if (payment) {
            const [proofRows] = await pool.execute(
                `SELECT proof_id, proof_url FROM payment_proof WHERE payment_id = ?`,
                [id]
            );
            payment.proofs = proofRows || [];
        }

        return payment;
    } catch (error) {
        console.error("Error in getPaymentById:", error);
        throw error;
    }
};


const getPaymentAllocations = async (paymentId) => {
    if (!paymentId) return [];
    try {
        const [rows] = await pool.execute(
            `SELECT pa.allocation_id, pa.payment_id, pa.charge_id, pa.amount,
                    c.description, c.charge_type, c.due_date,
                    l.lease_id
             FROM payment_allocations pa
             LEFT JOIN charges c ON pa.charge_id = c.charge_id
             LEFT JOIN leases l ON c.lease_id = l.lease_id
             WHERE pa.payment_id = ?
             ORDER BY pa.allocation_id`,
            [paymentId]
        );
        return rows || [];
    } catch (e) {
        console.error('Error in getPaymentAllocations:', e);
        throw e;
    }
};

const updatePaymentById = async (id, payment = {}, performedBy = null, io = null) => {
    const {
        chargeId,
        paymentDate,
        amountPaid,
        paymentMethod,
        notes,
        proofs,
        status,
    } = payment || {};
    const connHandle = await pool.getConnection();
    try {
        await connHandle.beginTransaction();

        const [currentRows] = await connHandle.execute(
            `SELECT status FROM payments WHERE payment_id = ? LIMIT 1`,
            [id]
        );
        const currentStatus =
            currentRows && currentRows.length ? currentRows[0].status : null;

        const newStatus = status || currentStatus;

        function mapToDbStatus(intent) {
            if (!intent && currentStatus) return currentStatus;
            const s = String(intent || "")
                .trim()
                .toLowerCase();
            if (!s) return currentStatus || "Pending";
            
            if (s.includes("confirm") || s.includes("complete") || s === "confirmed" || s === "completed") return "Confirmed";
            if (s.includes("reject") || s === "rejected") return "Rejected";
            if (s.includes("pending") || s === "pending") return "Pending";

            return currentStatus || "Pending";
        }

        const dbStatus = mapToDbStatus(newStatus);

    const newStatusNorm = String(newStatus || "").toLowerCase();
    const callerIntendsConfirm = newStatusNorm.includes("confirm") || newStatusNorm.includes("complete") || newStatusNorm === "confirmed" || newStatusNorm === "completed";
    const callerIntendsReject = newStatusNorm.includes("reject") || newStatusNorm === "rejected";
    const currentStatusNorm = String(currentStatus || "").toLowerCase();
    const alreadyConfirmed = currentStatusNorm === "confirmed" || currentStatusNorm === "completed";
    const alreadyRejected = currentStatusNorm === "rejected";

    
    
    const processedByUserId = ( (callerIntendsConfirm && !alreadyConfirmed) || (callerIntendsReject && !alreadyRejected) ) ? payment.user_id || null : null;
    const processedAt = ( (callerIntendsConfirm && !alreadyConfirmed) || (callerIntendsReject && !alreadyRejected) ) ? new Date() : null;

        
        const [existingPaymentRows] = await connHandle.execute(
            `SELECT payment_id, charge_id, amount, status, confirmed_by, confirmed_at, notes, payment_method FROM payments WHERE payment_id = ? LIMIT 1`,
            [id]
        );
        const existingPayment = existingPaymentRows && existingPaymentRows.length ? existingPaymentRows[0] : null;

        const updateQuery = `
            UPDATE payments
            SET
                charge_id = COALESCE(?, charge_id),
                created_at = COALESCE(?, created_at),
                amount = COALESCE(?, amount),
                payment_method = COALESCE(?, payment_method),
                notes = COALESCE(?, notes),
                status = ?,
                confirmed_by = COALESCE(confirmed_by, ?),
                confirmed_at = COALESCE(confirmed_at, ?)
            WHERE payment_id = ?
        `;

        await connHandle.execute(updateQuery, [
            chargeId || null,
            paymentDate || null,
            typeof amountPaid !== "undefined" && amountPaid !== null
                ? amountPaid
                : null,
            paymentMethod || null,
            notes || null,
            dbStatus,
            processedByUserId,
            processedAt,
            id,
        ]);

        if (proofs && Array.isArray(proofs)) {
            await connHandle.execute(
                `DELETE FROM payment_proof WHERE payment_id = ?`,
                [id]
            );
            const insertProof = `INSERT INTO payment_proof (payment_id, proof_url, uploaded_at) VALUES (?, ?, ?)`;
            const now = new Date();
            for (const url of proofs) {
                await connHandle.execute(insertProof, [id, String(url), now]);
            }
        }

        try {
            
            const payload = {
                old: existingPayment || null,
                changes: {
                    chargeId: chargeId || (existingPayment && existingPayment.charge_id) || null,
                    paymentDate: paymentDate || null,
                    amountPaid: typeof amountPaid !== "undefined" && amountPaid !== null ? amountPaid : (existingPayment && existingPayment.amount) || null,
                    paymentMethod: paymentMethod || (existingPayment && existingPayment.payment_method) || null,
                    notes: notes || (existingPayment && existingPayment.notes) || null,
                    status: newStatus,
                },
            };

            await connHandle.execute(
                `INSERT INTO payment_audit (payment_id, action, payload, performed_by, created_at) VALUES (?, ?, ?, ?, ?)`,
                [
                    id,
                    "update",
                    JSON.stringify(payload),
                    performedBy || null,
                    new Date(),
                ]
            );
        } catch (err) {
            console.error("Failed to write payment_audit (update):", err);
        }

    
    let allocRows = [];
    try {
        const [rowsAlloc] = await connHandle.execute(
            `SELECT charge_id, amount FROM payment_allocations WHERE payment_id = ?`,
            [id]
        );
        allocRows = rowsAlloc || [];
    } catch {}

    if (callerIntendsConfirm && currentStatus !== "Confirmed" && allocRows.length > 0) {
            
            try {
                for (const alloc of allocRows) {
                    const acId = alloc.charge_id;
                    const aAmt = Number(alloc.amount || 0);
                    if (!acId || !(aAmt > 0)) continue;
                    const [cRows2] = await connHandle.execute(
                        `SELECT amount, total_paid, status FROM charges WHERE charge_id = ? LIMIT 1`,
                        [acId]
                    );
                    if (!cRows2 || !cRows2.length) continue;
                    const currAmount = Number(cRows2[0].amount || 0);
                    const currPaid = Number(cRows2[0].total_paid || 0);
                    const newPaid = currPaid + aAmt;
                    let newChargeStatus = "Unpaid";
                    if (newPaid <= 0) newChargeStatus = "Unpaid";
                    else if (newPaid >= currAmount) newChargeStatus = "Paid";
                    else newChargeStatus = "Partially Paid";
                    await connHandle.execute(
                        `UPDATE charges SET total_paid = ?, status = ? WHERE charge_id = ?`,
                        [newPaid, newChargeStatus, acId]
                    );
                    try {
                        await connHandle.execute(
                            `INSERT INTO charge_status_audit (charge_id, old_status, new_status, old_total_paid, new_total_paid, performed_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [
                                acId,
                                cRows2[0].status || null,
                                newChargeStatus,
                                currPaid,
                                newPaid,
                                processedByUserId || performedBy || null,
                                new Date(),
                            ]
                        );
                    } catch (e) {
                        console.error("Failed to write charge_status_audit on consolidated confirm:", e);
                    }
                }
            } catch (e) {
                console.error('Failed applying consolidated allocations:', e);
            }

            
            try {
                const [detailRows] = await connHandle.execute(
                    `SELECT 
                        pay.payment_id,
                        pay.amount AS amount_paid,
                        pay.payment_method,
                        pay.notes,
                        pay.created_at,
                        l.lease_id,
                        l.user_id AS tenant_user_id,
                        CONCAT(u.first_name, ' ', u.last_name, IFNULL(CONCAT(' ', u.suffix), '')) AS tenant_name,
                        p.property_name
                    FROM payments pay
                    LEFT JOIN charges c ON pay.charge_id = c.charge_id
                    LEFT JOIN leases l ON c.lease_id = l.lease_id
                    LEFT JOIN users u ON l.user_id = u.user_id
                    LEFT JOIN properties p ON l.property_id = p.property_id
                    WHERE pay.payment_id = ?
                    LIMIT 1`,
                    [id]
                );
                const info = detailRows && detailRows.length ? detailRows[0] : null;
                
                let leaseId = info && info.lease_id ? info.lease_id : null;
                if (!leaseId && allocRows.length) {
                    const firstChargeId = allocRows[0].charge_id;
                    const [lr] = await connHandle.execute(
                        `SELECT l.lease_id, CONCAT(u.first_name, ' ', u.last_name, IFNULL(CONCAT(' ', u.suffix), '')) AS tenant_name,
                                p.property_name
                         FROM charges c
                         LEFT JOIN leases l ON c.lease_id = l.lease_id
                         LEFT JOIN users u ON l.user_id = u.user_id
                         LEFT JOIN properties p ON l.property_id = p.property_id
                         WHERE c.charge_id = ?
                         LIMIT 1`,
                        [firstChargeId]
                    );
                    if (lr && lr.length) {
                        leaseId = lr[0].lease_id;
                        if (info) {
                            info.lease_id = leaseId;
                            info.tenant_name = info.tenant_name || lr[0].tenant_name || null;
                            info.property_name = info.property_name || lr[0].property_name || null;
                        }
                    }
                }
                if (leaseId) {
                    const [invExistsRows] = await connHandle.execute(
                        `SELECT COUNT(*) AS cnt FROM invoices WHERE payment_id = ?`,
                        [id]
                    );
                    const invExists = invExistsRows && invExistsRows.length ? Number(invExistsRows[0].cnt || 0) > 0 : false;
                    if (!invExists) {
                        const [invResult] = await connHandle.execute(
                            `INSERT INTO invoices (payment_id, lease_id, tenant_name, property_name, total_amount, payment_method, reference_number, status, notes)
                             VALUES (?, ?, ?, ?, ?, ?, ?, 'Issued', ?)`,
                            [
                                id,
                                leaseId,
                                (info && info.tenant_name) || null,
                                (info && info.property_name) || null,
                                Number((info && info.amount_paid) || 0),
                                (info && info.payment_method) || null,
                                id,
                                (info && info.notes) || null,
                            ]
                        );
                        const newInvoiceId = invResult && invResult.insertId ? invResult.insertId : null;
                        if (newInvoiceId) {
                            const now = new Date();
                            for (const alloc of allocRows) {
                                const [cr] = await connHandle.execute(
                                    `SELECT c.description, c.charge_type, c.amount AS original_amount, c.due_date,
                                            l.grace_period_days, l.late_fee_percentage
                                     FROM charges c
                                     LEFT JOIN leases l ON c.lease_id = l.lease_id
                                     WHERE c.charge_id = ?
                                     LIMIT 1`,
                                    [alloc.charge_id]
                                );
                                const row = cr && cr.length ? cr[0] : null;
                                const desc = (row && row.description) || 'Charge';
                                const ctype = (row && row.charge_type) || null;
                                const allocAmt = Number(alloc.amount || 0);
                                await connHandle.execute(
                                    `INSERT INTO invoice_items (invoice_id, charge_id, description, item_type, amount) VALUES (?, ?, ?, ?, ?)`,
                                    [newInvoiceId, alloc.charge_id, desc, ctype, allocAmt]
                                );
                                
                                if (row && row.due_date) {
                                    const due = new Date(row.due_date);
                                    const daysPast = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
                                    const grace = Number(row.grace_period_days || 0);
                                    const pct = Number(row.late_fee_percentage || 0);
                                    if (daysPast > grace && pct > 0) {
                                        const lateFee = Math.round((Number(row.original_amount || 0) * pct / 100) * 100) / 100;
                                        if (lateFee > 0) {
                                            await connHandle.execute(
                                                `INSERT INTO invoice_items (invoice_id, charge_id, description, item_type, amount) VALUES (?, ?, ?, ?, ?)`,
                                                [newInvoiceId, alloc.charge_id, 'Late Fee', 'fee', lateFee]
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    }

                    
                    try {
                        const targetUserId = (info && info.tenant_user_id) || null;
                        if (targetUserId && callerIntendsConfirm && !alreadyConfirmed) {
                            await notificationsServices.createNotification({
                                user_id: targetUserId,
                                type: 'PAYMENT',
                                title: 'Payment Confirmed',
                                body: `Your payment ${id} has been confirmed.`,
                                link: '/paymentTenant.html',
                                meta: { payment_id: id, status: 'Confirmed' }
                            }, io);
                        }
                    } catch (notifyErr) {
                        console.warn('Failed to create payment confirmation notification', notifyErr);
                    }
                }
            } catch (invErr) {
                console.error('Failed to create consolidated invoice:', invErr);
            }
    } else if (callerIntendsConfirm && currentStatus !== "Confirmed" && chargeId) {
            
            let amtToApply = amountPaid;
            if (amtToApply === undefined || amtToApply === null) {
                const [amtRows] = await connHandle.execute(
                    `SELECT amount FROM payments WHERE payment_id = ? LIMIT 1`,
                    [id]
                );
                amtToApply =
                    amtRows && amtRows.length ? Number(amtRows[0].amount || 0) : 0;
            }

            const [cRows] = await connHandle.execute(
                `SELECT amount, total_paid, status FROM charges WHERE charge_id = ? LIMIT 1`,
                [chargeId]
            );
            if (cRows && cRows.length) {
                const currAmount = Number(cRows[0].amount || 0);
                const currPaid = Number(cRows[0].total_paid || 0);
                const newPaid = currPaid + Number(amtToApply || 0);
                let newChargeStatus = "Unpaid";
                if (newPaid <= 0) newChargeStatus = "Unpaid";
                else if (newPaid >= currAmount) newChargeStatus = "Paid";
                else newChargeStatus = "Partially Paid";

                await connHandle.execute(
                    `UPDATE charges SET total_paid = ?, status = ? WHERE charge_id = ?`,
                    [newPaid, newChargeStatus, chargeId]
                );

                try {
                    await connHandle.execute(
                        `INSERT INTO charge_status_audit (charge_id, old_status, new_status, old_total_paid, new_total_paid, performed_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            chargeId,
                            cRows[0].status || null,
                            newChargeStatus,
                            currPaid,
                            newPaid,
                            processedByUserId || performedBy || null,
                            new Date(),
                        ]
                    );
                } catch (e) {
                    console.error("Failed to write charge_status_audit on confirm:", e);
                }
            }

            
            try {
                const [detailRows] = await connHandle.execute(
                    `SELECT 
                        pay.payment_id,
                        pay.amount AS amount_paid,
                        pay.payment_method,
                        pay.notes,
                        pay.created_at,
                        l.lease_id,
                        l.user_id AS tenant_user_id,
                        CONCAT(u.first_name, ' ', u.last_name, IFNULL(CONCAT(' ', u.suffix), '')) AS tenant_name,
                        p.property_name
                    FROM payments pay
                    LEFT JOIN charges c ON pay.charge_id = c.charge_id
                    LEFT JOIN leases l ON c.lease_id = l.lease_id
                    LEFT JOIN users u ON l.user_id = u.user_id
                    LEFT JOIN properties p ON l.property_id = p.property_id
                    WHERE pay.payment_id = ?
                    LIMIT 1`,
                    [id]
                );
                const info = detailRows && detailRows.length ? detailRows[0] : null;
                if (info && info.lease_id) {
                    const [invExistsRows] = await connHandle.execute(
                        `SELECT COUNT(*) AS cnt FROM invoices WHERE payment_id = ?`,
                        [info.payment_id]
                    );
                    const invExists = invExistsRows && invExistsRows.length ? Number(invExistsRows[0].cnt || 0) > 0 : false;
                    if (!invExists) {
                        const [invResult] = await connHandle.execute(
                            `INSERT INTO invoices (payment_id, lease_id, tenant_name, property_name, total_amount, payment_method, reference_number, status, notes)
                             VALUES (?, ?, ?, ?, ?, ?, ?, 'Issued', ?)` ,
                            [
                                info.payment_id,
                                info.lease_id,
                                info.tenant_name || null,
                                info.property_name || null,
                                Number(info.amount_paid || 0),
                                info.payment_method || null,
                                info.payment_id,
                                info.notes || null,
                            ]
                        );

                        
                        try {
                            const newInvoiceId = invResult && invResult.insertId ? invResult.insertId : null;
                            if (newInvoiceId && chargeId) {
                                
                                const [chargeRows2] = await connHandle.execute(
                                    `SELECT c.charge_id, c.description, c.charge_type, c.amount AS original_amount, c.due_date,
                                            l.grace_period_days, l.late_fee_percentage
                                     FROM charges c
                                     LEFT JOIN leases l ON c.lease_id = l.lease_id
                                     WHERE c.charge_id = ?
                                     LIMIT 1`,
                                    [chargeId]
                                );
                                const cr = chargeRows2 && chargeRows2.length ? chargeRows2[0] : null;
                                if (cr) {
                                    const now = new Date();
                                    const dueDate = cr.due_date ? new Date(cr.due_date) : null;
                                    let lateFee = 0;
                                    if (dueDate) {
                                        const ms = now.getTime() - dueDate.getTime();
                                        const daysPast = Math.floor(ms / (1000 * 60 * 60 * 24));
                                        const grace = Number(cr.grace_period_days || 0);
                                        const pct = Number(cr.late_fee_percentage || 0);
                                        if (daysPast > grace && pct > 0) {
                                            lateFee = Math.round((Number(cr.original_amount || 0) * pct / 100) * 100) / 100;
                                        }
                                    }

                                    
                                    await connHandle.execute(
                                        `INSERT INTO invoice_items (invoice_id, charge_id, description, item_type, amount)
                                         VALUES (?, ?, ?, ?, ?)`,
                                        [
                                            newInvoiceId,
                                            cr.charge_id,
                                            cr.description || 'Charge',
                                            cr.charge_type || null,
                                            Number(cr.original_amount || 0),
                                        ]
                                    );

                                    
                                    if (lateFee > 0) {
                                        await connHandle.execute(
                                            `INSERT INTO invoice_items (invoice_id, charge_id, description, item_type, amount)
                                             VALUES (?, ?, ?, ?, ?)`,
                                            [
                                                newInvoiceId,
                                                cr.charge_id,
                                                'Late Fee',
                                                'fee',
                                                Number(lateFee),
                                            ]
                                        );
                                    }

                                    
                                    try {
                                        const paidTotal = Number(info.amount_paid || 0);
                                        let covered = Number(cr.original_amount || 0) + Number(lateFee || 0);
                                        const remaining = () => Math.max(0, Math.round((paidTotal - covered) * 100) / 100);

                                        if (remaining() > 0 && info.lease_id) {
                                            const [otherRows] = await connHandle.execute(
                                                `SELECT c.charge_id, c.description, c.charge_type, c.amount AS original_amount, c.due_date,
                                                        l.grace_period_days, l.late_fee_percentage,
                                                        IFNULL(c.total_paid, 0) AS total_paid
                                                 FROM charges c
                                                 LEFT JOIN leases l ON c.lease_id = l.lease_id
                                                 WHERE c.lease_id = ? AND c.charge_id <> ? AND (c.status IS NULL OR c.status <> 'Waived')
                                                 ORDER BY c.due_date ASC, c.charge_date ASC, c.charge_id ASC`,
                                                [info.lease_id, cr.charge_id]
                                            );
                                            for (const oc of (otherRows || [])) {
                                                if (remaining() <= 0) break;
                                                
                                                const odue = oc.due_date ? new Date(oc.due_date) : null;
                                                let olate = 0;
                                                if (odue) {
                                                    const ms2 = now.getTime() - odue.getTime();
                                                    const daysPast2 = Math.floor(ms2 / (1000 * 60 * 60 * 24));
                                                    const grace2 = Number(oc.grace_period_days || 0);
                                                    const pct2 = Number(oc.late_fee_percentage || 0);
                                                    if (daysPast2 > grace2 && pct2 > 0) {
                                                        olate = Math.round((Number(oc.original_amount || 0) * pct2 / 100) * 100) / 100;
                                                    }
                                                }
                                                const eff = Math.max(0, Number(oc.original_amount || 0) + Number(olate || 0) - Number(oc.total_paid || 0));
                                                if (eff <= 0) continue;
                                                if (eff <= remaining()) {
                                                    
                                                    await connHandle.execute(
                                                        `INSERT INTO invoice_items (invoice_id, charge_id, description, item_type, amount)
                                                         VALUES (?, ?, ?, ?, ?)`,
                                                        [
                                                            newInvoiceId,
                                                            oc.charge_id,
                                                            oc.description || 'Charge',
                                                            oc.charge_type || null,
                                                            Number(eff),
                                                        ]
                                                    );
                                                    covered = Math.round((covered + eff) * 100) / 100;
                                                } else {
                                                    
                                                    break;
                                                }
                                            }
                                        }
                                    } catch (moreErr) {
                                        console.warn('Auto-add additional charges to invoice failed:', moreErr);
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('Failed to insert invoice_items for payment:', id, e);
                        }
                    }
                }
                
                try {
                    const targetUserId = (info && info.tenant_user_id) || null;
                    if (targetUserId && callerIntendsConfirm && !alreadyConfirmed) {
                        await notificationsServices.createNotification({
                            user_id: targetUserId,
                            type: 'PAYMENT',
                            title: 'Payment Confirmed',
                            body: `Your payment ${id} has been confirmed.`,
                            link: '/paymentTenant.html',
                            meta: { payment_id: id, status: 'Confirmed' }
                        }, io);
                    }
                } catch (notifyErr) {
                    console.warn('Failed to create payment confirmation notification', notifyErr);
                }
            } catch (invErr) {
                console.error("Failed to insert invoice for payment:", id, invErr);
            }
        }

        
        if (allocRows.length === 0 && chargeId) {
            await computeAndSetChargeStatus(
                connHandle,
                chargeId,
                processedByUserId || performedBy
            );
        }
        await connHandle.commit();

        
        try {
            if (callerIntendsReject && !alreadyRejected) {
                
                const [infoRows] = await pool.execute(
                    `SELECT l.user_id AS tenant_user_id
                     FROM payments pay
                     LEFT JOIN charges c ON pay.charge_id = c.charge_id
                     LEFT JOIN leases l ON c.lease_id = l.lease_id
                     WHERE pay.payment_id = ?
                     LIMIT 1`,
                    [id]
                );
                const targetUserId = infoRows && infoRows.length ? infoRows[0].tenant_user_id : null;
                if (targetUserId) {
                    await notificationsServices.createNotification({
                        user_id: targetUserId,
                        type: 'PAYMENT',
                        title: 'Payment Rejected',
                        body: `Your payment ${id} was rejected. Please review and resubmit.`,
                        link: '/paymentTenant.html',
                        meta: { payment_id: id, status: 'Rejected' }
                    }, io);
                }
            }
        } catch (notifyErr) {
            console.warn('Failed to create payment rejection notification', notifyErr);
        }
        return { message: "Payment updated successfully" };
    } catch (error) {
        await connHandle.rollback();
        console.error("Error in updatePaymentById:", error);
        throw error;
    } finally {
        connHandle.release();
    }
};

const deletePaymentById = async (id, performedBy = null) => {
    const connHandle = await pool.getConnection();
    try {
        await connHandle.beginTransaction();

        
        const [paymentRows] = await connHandle.execute(
            `SELECT * FROM payments WHERE payment_id = ? LIMIT 1`,
            [id]
        );
        const existingPayment = paymentRows && paymentRows.length ? paymentRows[0] : null;
        const chargeId = existingPayment ? existingPayment.charge_id : null;

        await connHandle.execute(`DELETE FROM payment_proof WHERE payment_id = ?`, [
            id,
        ]);
        await connHandle.execute(`DELETE FROM payments WHERE payment_id = ?`, [id]);

        await computeAndSetChargeStatus(connHandle, chargeId, performedBy);

        try {
            await connHandle.execute(
                `INSERT INTO payment_audit (payment_id, action, payload, performed_by, created_at) VALUES (?, ?, ?, ?, ?)`,
                [
                    id,
                    "delete",
                    JSON.stringify({ old: existingPayment || null }),
                    performedBy || null,
                    new Date(),
                ]
            );
        } catch (err) {
            console.error("Failed to write payment_audit (delete):", err);
        }

        await connHandle.commit();
        return { message: "Payment deleted successfully" };
    } catch (error) {
        await connHandle.rollback();
        console.error("Error in deletePaymentById:", error);
        throw error;
    } finally {
        connHandle.release();
    }
};

export default {
    createPayment,
    async createConsolidatedPayment(paymentData = {}, performedBy = null) {
        const { paymentDate, amountPaid, paymentMethod, notes, user_id, proofs = [], allocations = [] } = paymentData || {};
        if (!Array.isArray(allocations) || allocations.length === 0) throw new Error('allocations required');
        const totalAlloc = allocations.reduce((s, a) => s + (Number(a.amount) || 0), 0);
        const grandAmount = typeof amountPaid === 'number' ? amountPaid : totalAlloc;
        if (grandAmount <= 0) throw new Error('amount must be greater than 0');

        const paymentId = uuidv4();
        const createdAt = new Date();
        const connHandle = await pool.getConnection();
        try {
            await connHandle.beginTransaction();

            const status = 'Pending';
            const insertPayment = `
                INSERT INTO payments (payment_id, charge_id, user_id, amount, payment_method, status, notes, confirmed_by, confirmed_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
            `;
            const firstChargeId = allocations[0] && (allocations[0].chargeId || allocations[0].charge_id) || null;
            await connHandle.execute(insertPayment, [
                paymentId,
                firstChargeId,
                user_id || null,
                grandAmount,
                paymentMethod || null,
                status,
                notes || null,
                createdAt,
            ]);

            
            const insertAlloc = `INSERT INTO payment_allocations (payment_id, charge_id, amount, created_at) VALUES (?, ?, ?, ?)`;
            for (const a of allocations) {
                const cid = a.chargeId || a.charge_id;
                const amt = Number(a.amount) || 0;
                if (!cid || !(amt > 0)) continue;
                await connHandle.execute(insertAlloc, [paymentId, cid, amt, createdAt]);
            }

            
            if (proofs && proofs.length) {
                const insertProof = `INSERT INTO payment_proof (payment_id, proof_url, uploaded_at) VALUES (?, ?, ?)`;
                for (const url of proofs) {
                    await connHandle.execute(insertProof, [paymentId, String(url), createdAt]);
                }
            }

            
            try {
                await connHandle.execute(
                    `INSERT INTO payment_audit (payment_id, action, payload, performed_by, created_at) VALUES (?, ?, ?, ?, ?)`,
                    [paymentId, 'create_consolidated', JSON.stringify({ amount: grandAmount, paymentMethod, notes, allocations }), performedBy || null, createdAt]
                );
            } catch (e) { console.error('Failed to write payment_audit (create_consolidated):', e); }

            
            

            await connHandle.commit();
            return { message: 'Payment created successfully', payment_id: paymentId };
        } catch (err) {
            await connHandle.rollback();
            console.error('Error in createConsolidatedPayment:', err);
            throw err;
        } finally {
            connHandle.release();
        }
    },
    getAllPayments,
    getPaymentsByUserId,
    updatePaymentById,
    getPaymentById,
    deletePaymentById,
    getPaymentAllocations,
    async getPaymentsStats() {
        try {
            const [countRows] = await pool.execute(`SELECT COUNT(*) AS cnt FROM payments`);
            const totalPayments = Number(countRows?.[0]?.cnt || 0);

            const [sumRows] = await pool.execute(`
                SELECT 
                    IFNULL(SUM(CASE WHEN status = 'Confirmed' OR status = 'Completed' THEN amount ELSE 0 END), 0) AS total_collected,
                    IFNULL(SUM(CASE WHEN DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') AND (status = 'Confirmed' OR status = 'Completed') THEN amount ELSE 0 END), 0) AS collected_this_month
                FROM payments
            `);
            const totalCollected = Number(sumRows?.[0]?.total_collected || 0);
            const collectedThisMonth = Number(sumRows?.[0]?.collected_this_month || 0);

            const [pendingRows] = await pool.execute(`SELECT COUNT(*) AS cnt FROM payments WHERE status = 'Pending'`);
            const pendingCount = Number(pendingRows?.[0]?.cnt || 0);

            return { totalPayments, totalCollected, collectedThisMonth, pendingCount };
        } catch (error) {
            console.error('Error computing payments stats:', error);
            throw error;
        }
    },
    async searchPaymentsByChargeIds({
        chargeIds = [],
        status = null,
        userId = null,
    } = {}) {
        if (!Array.isArray(chargeIds) || !chargeIds.length) return [];
        const placeholders = chargeIds.map(() => "?").join(",");
        const baseParams = [...chargeIds];

        
        const filters = [];
        const filterParams = [];
        if (status) {
            const s = String(status).toLowerCase();
            if (s === 'confirmed') {
                
                filters.push("(p.status = 'Confirmed' OR p.status = 'Completed')");
            } else {
                filters.push("p.status = ?");
                filterParams.push(status);
            }
        }
        if (userId) {
            filters.push("p.user_id = ?");
            filterParams.push(userId);
        }
        const wherePay = filters.length ? ` AND ${filters.join(' AND ')}` : '';

        
        const sqlDirect = `
            SELECT 
                p.payment_id,
                p.charge_id,
                p.amount AS amount_paid,
                p.status,
                p.payment_method,
                p.created_at
            FROM payments p
            WHERE p.charge_id IN (${placeholders})
            ${wherePay}
              AND NOT EXISTS (
                  SELECT 1 FROM payment_allocations pa2 WHERE pa2.payment_id = p.payment_id
              )
        `;

        
        const sqlAlloc = `
            SELECT 
                p.payment_id,
                pa.charge_id,
                pa.amount AS amount_paid,
                p.status,
                p.payment_method,
                p.created_at
            FROM payment_allocations pa
            INNER JOIN payments p ON p.payment_id = pa.payment_id
            WHERE pa.charge_id IN (${placeholders})
            ${wherePay}
        `;

        
        const [rowsDirect] = await pool.execute(sqlDirect, [...baseParams, ...filterParams]);
        const [rowsAlloc] = await pool.execute(sqlAlloc, [...baseParams, ...filterParams]);

        const merged = [...(rowsDirect || []), ...(rowsAlloc || [])];
        
        merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return merged;
    },
};
