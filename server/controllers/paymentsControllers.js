import expressAsync from "express-async-handler";
import paymentsServices from "../services/paymentsServices.js";

const extractProofUrls = (req) => {
    if (!req.files) return [];
    const proofs = [];
    Object.values(req.files).forEach((fileArray) => {
        if (!Array.isArray(fileArray)) return;
        fileArray.forEach((f) => {
            const url = f.path || f.location || f.secure_url || f.url || null;
            if (url) proofs.push(url);
        });
    });
    return proofs;
};

const createPayment = expressAsync(async (req, res) => {
    const raw = req.body || {};
    const proofs = extractProofUrls(req);

    
    
    let allocations = [];
    try {
        if (raw.allocations) {
            allocations = typeof raw.allocations === 'string' ? JSON.parse(raw.allocations) : raw.allocations;
        } else if (raw.allocation) {
            allocations = typeof raw.allocation === 'string' ? JSON.parse(raw.allocation) : raw.allocation;
        }
        if (!Array.isArray(allocations)) allocations = [];
    } catch {}

    const base = {
        paymentDate: raw.paymentDate || raw.payment_date || null,
        amountPaid: raw.amountPaid || raw.amount_paid || raw.amount || null,
        paymentMethod: raw.paymentMethod || raw.payment_method || null,
        notes: raw.notes || null,
        user_id: raw.user_id || req.user?.user_id || null,
        proofs,
        allocations,
    };

    
    if (!allocations.length) {
        const payment = { ...base, chargeId: raw.chargeId || raw.charge_id || null };
        if (!payment.chargeId) {
            return res.status(400).json({ message: "chargeId is required" });
        }
        if (payment.amountPaid !== null) payment.amountPaid = Number(payment.amountPaid);
        const performedBy = req.user ? (`${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email || req.user.user_id) : null;
        const result = await paymentsServices.createPayment(payment, performedBy);
        return res.status(201).json(result);
    }

    
    const performedBy = req.user ? (`${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email || req.user.user_id) : null;
    const result = await paymentsServices.createConsolidatedPayment(base, performedBy);
    return res.status(201).json(result);
});

const getAllPayments = expressAsync(async (req, res) => {
    const { status, payment_method, payment_type, month, q } = req.query || {};
    const page = Number.isFinite(parseInt(req.query.page, 10)) && parseInt(req.query.page, 10) > 0
        ? parseInt(req.query.page, 10)
        : 1;
    const limitRaw = Number.isFinite(parseInt(req.query.limit, 10)) && parseInt(req.query.limit, 10) > 0
        ? parseInt(req.query.limit, 10)
        : 10;
    const limit = Math.min(100, limitRaw);
    const result = await paymentsServices.getAllPayments({ status, payment_method, payment_type, month, q, page, limit });
    res.status(200).json({
        payments: result.rows,
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
    });
});

const getPaymentsByUserId = expressAsync(async (req, res) => {
    const authUserId = req.user?.user_id || null;
    if (!authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const { userId } = req.params || {};
    const targetUserId = userId || authUserId;

    if (String(targetUserId) !== String(authUserId)) {
        return res.status(403).json({ message: "Forbidden" });
    }

    const page = Number.isFinite(parseInt(req.query.page, 10)) && parseInt(req.query.page, 10) > 0
        ? parseInt(req.query.page, 10)
        : 1;
    const limitRaw = Number.isFinite(parseInt(req.query.limit, 10)) && parseInt(req.query.limit, 10) > 0
        ? parseInt(req.query.limit, 10)
        : 10;
    const limit = Math.min(100, limitRaw);
    const result = await paymentsServices.getPaymentsByUserId(targetUserId, { page, limit });
    res.status(200).json({
        payments: result.rows,
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
    });
});

const getPaymentById = expressAsync(async (req, res) => {
    const { id } = req.params;
    const result = await paymentsServices.getPaymentById(id);
    if (!result) return res.status(404).json({ message: "Payment not found" });
    res.status(200).json(result);
});

const updatePaymentById = expressAsync(async (req, res) => {
    const { id } = req.params;
    const raw = req.body || {};


    const payment = {
        chargeId: raw.chargeId || raw.charge_id || null,
        paymentDate: raw.paymentDate || raw.payment_date || null,
        amountPaid: raw.amountPaid || raw.amount_paid || raw.amount || null,
        paymentMethod: raw.paymentMethod || raw.payment_method || null,
        notes: raw.notes || null,
        status: raw.status || null,
        user_id: req.user?.user_id || null,
    };

    const proofs = extractProofUrls(req);
    if (proofs.length) payment.proofs = proofs;

    if (!payment.chargeId) {
        const current = await paymentsServices.getPaymentById(id);
        if (!current) return res.status(404).json({ message: "Payment not found" });
        payment.chargeId = current.charge_id || null;
        if (!payment.chargeId) {
            return res
                .status(400)
                .json({ message: "chargeId is required for update" });
        }
    }

    if (payment.amountPaid !== null)
        payment.amountPaid = Number(payment.amountPaid);

    const performedBy = req.user
        ? `${req.user.first_name || ""} ${req.user.last_name || ""}`.trim() ||
        req.user.email ||
        req.user.user_id
        : null;
    const io = req.app && req.app.get ? req.app.get('io') : null;
    const result = await paymentsServices.updatePaymentById(
        id,
        payment,
        performedBy,
        io
    );
    res.status(200).json(result);
});

const deletePaymentById = expressAsync(async (req, res) => {
    const { id } = req.params;
    const performedBy = req.user
        ? `${req.user.first_name || ""} ${req.user.last_name || ""}`.trim() ||
        req.user.email ||
        req.user.user_id
        : null;
    const result = await paymentsServices.deletePaymentById(id, performedBy);
    res.status(200).json(result);
});

const searchPayments = expressAsync(async (req, res) => {
    const { charge_ids, status } = req.query || {};
    const chargeIds =
        typeof charge_ids === "string"
            ? charge_ids
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : Array.isArray(charge_ids)
                ? charge_ids
                : [];

    if (!chargeIds.length) {
        return res.status(400).json({ message: "charge_ids is required" });
    }

    const userId = req.user?.user_id || null;
    const rows = await paymentsServices.searchPaymentsByChargeIds({
        chargeIds,
        status,
        userId,
    });
    res.status(200).json({ payments: rows });
});

const getPaymentsStats = expressAsync(async (_req, res) => {
    const stats = await paymentsServices.getPaymentsStats();
    res.status(200).json(stats);
});

export {
    createPayment,
    getAllPayments,
    getPaymentsByUserId,
    getPaymentById,
    updatePaymentById,
    deletePaymentById,
    searchPayments,
    getPaymentsStats,
};


export const getPaymentAllocations = expressAsync(async (req, res) => {
    const { id } = req.params;
    const rows = await paymentsServices.getPaymentAllocations(id);
    res.status(200).json({ allocations: rows });
});
