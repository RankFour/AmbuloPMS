import usersServices from "../services/usersServices.js";
import ticketsServices from "../services/ticketsServices.js";
import leaseServices from "../services/leaseServices.js";
import paymentsServices from "../services/paymentsServices.js";
import chargesServices from "../services/chargesServices.js";
import faqsServices from "../services/faqsServices.js";
import messagesServices from "../services/messagesServices.js";
import propertiesServices from "../services/propertiesServices.js";
import companyDetailsServices from "../services/companyDetailsServices.js";
import aboutUsServices from "../services/aboutUsServices.js";
import { getInvoiceByPaymentId } from "../services/invoicesServices.js";
import reportsServices from "../services/reportsServices.js";
import notificationsServices from "../services/notificationsServices.js";

const isAdminLike = (role) =>
    ["ADMIN", "MANAGER"].includes(String(role || "").toUpperCase());

const initSession = async (req, res) => {
    try {
        const { user_id, role, first_name, last_name, email } = req.user || {};
        if (!user_id) return res.status(401).json({ message: "Unauthorized" });

        const claims = {
            user_id,
            role,
            display_name:
                [first_name, last_name].filter(Boolean).join(" ") || email || "User",
        };

        return res.json({
            message: "Assistant session initialized",
            claims,
        });
    } catch (e) {
        return res
            .status(500)
            .json({ message: e.message || "Failed to init assistant session" });
    }
};

const getMyProfile = async (req, res) => {
    try {
        const { user_id } = req.user || {};
        const user = await usersServices.getSingleUserById(user_id);

        const { password_hash, ...safe } = user;
        return res.json({ profile: safe });
    } catch (e) {
        return res
            .status(500)
            .json({ message: e.message || "Failed to get profile" });
    }
};

const getMyTickets = async (req, res) => {
    try {
        const { user_id } = req.user || {};
        const { page = 1, limit = 10, status } = req.query;
        const data = await ticketsServices.getTicketsByUserId(user_id, {
            page,
            limit,
        });

        const tickets =
            status && String(status).toLowerCase() !== "all"
                ? data.tickets.filter(
                    (t) =>
                        String(t.ticket_status).toUpperCase() ===
                        String(status).toUpperCase()
                )
                : data.tickets;
        return res.json({
            tickets,
            pagination: data.pagination,
        });
    } catch (e) {
        return res
            .status(500)
            .json({ message: e.message || "Failed to get tickets" });
    }
};

export default {
    initSession,
    getMyProfile,
    getMyTickets,
    /**
     * Browse properties (tenant/admin). Supports filters: status, search, min/max_rent, min/max_area, city, page, limit
     */
    async listProperties(req, res) {
        try {
            const data = await propertiesServices.getProperties(req.query || {});
            return res.json(data);
        } catch (e) {
            return res.status(500).json({ message: e.message || 'Failed to list properties' });
        }
    },
    /**
     * Get single property details by id
     */
    async getProperty(req, res) {
        try {
            const { property_id } = req.params;
            if (!property_id) return res.status(400).json({ message: 'property_id is required' });
            const data = await propertiesServices.getSinglePropertyById(property_id);
            return res.json(data);
        } catch (e) {
            return res.status(500).json({ message: e.message || 'Failed to get property' });
        }
    },
    /**
     * Company details (tenant/admin)
     */
    async getCompany(req, res) {
        try {
            const rows = await companyDetailsServices.getCompanyDetails();
            return res.json({ company: Array.isArray(rows) && rows.length ? rows[0] : null });
        } catch (e) {
            return res.status(500).json({ message: e.message || 'Failed to get company details' });
        }
    },
    /**
     * About Us content (tenant/admin)
     */
    async getAbout(req, res) {
        try {
            const data = await aboutUsServices.getAboutUs();
            return res.json(data);
        } catch (e) {
            return res.status(500).json({ message: e.message || 'Failed to get About Us' });
        }
    },
    /**
     * My notifications (tenant/admin)
     */
    async getMyNotifications(req, res) {
        try {
            const { user_id } = req.user || {};
            const { page = 1, limit = 10, unread } = req.query || {};
            // notificationsServices likely has createNotification only; if no list exists, fallback: return empty
            if (!notificationsServices.getNotificationsByUser) {
                return res.json({ notifications: [], pagination: { currentPage: 1, totalPages: 1, total: 0 } });
            }
            const data = await notificationsServices.getNotificationsByUser(String(user_id), { page, limit, unread });
            return res.json(data);
        } catch (e) {
            return res.status(500).json({ message: e.message || 'Failed to get notifications' });
        }
    },
    /**
     * Invoice details by payment id (tenant/admin)
     */
    async getInvoiceByPayment(req, res) {
        try {
            const { payment_id } = req.params;
            if (!payment_id) return res.status(400).json({ message: 'payment_id is required' });
            const data = await getInvoiceByPaymentId(payment_id);
            return res.json({ invoice: data });
        } catch (e) {
            return res.status(500).json({ message: e.message || 'Failed to get invoice' });
        }
    },
    /**
     * Stats: charges counts (admin)
     * - If no status provided, returns overview: total, overdue, dueSoon, outstanding
     * - If status provided, returns { total } for that status using generic search
     */
    async getChargesStats(req, res) {
        try {
            const { role } = req.user || {};
            if (!isAdminLike(role)) return res.status(403).json({ message: 'Forbidden' });
            const { status } = req.query || {};
            if (status) {
                const s = String(status);
                const data = await chargesServices.getAllCharges({ status: s, page: 1, limit: 1 });
                const total = Number(data?.total || 0);
                return res.json({ status: s, total });
            }
            const stats = await chargesServices.getChargesStats();
            return res.json(stats);
        } catch (e) {
            return res.status(500).json({ message: e.message || 'Failed to get charges stats' });
        }
    },
    /**
     * Stats: properties count (admin/tenant)
     * - Supports property_status filter (e.g., Available)
     */
    async getPropertiesStats(req, res) {
        try {
            const { property_status } = req.query || {};
            const q = { ...req.query, page: 1, limit: 1 };
            // Only count is needed; leverage existing service's total
            const data = await propertiesServices.getProperties(q);
            return res.json({
                property_status: property_status || 'all',
                total: Number(data?.total || Array.isArray(data?.properties) ? data.properties.length : 0),
            });
        } catch (e) {
            return res.status(500).json({ message: e.message || 'Failed to get properties stats' });
        }
    },
    /**
     * Me: list my messages with another user (direct conversation)
     */
    async getMyMessages(req, res) {
        try {
            const { user_id } = req.user || {};
            const {
                other_user_id,
                page = 1,
                limit = 20,
                search,
                sort,
            } = req.query || {};
            if (!user_id) return res.status(401).json({ message: "Unauthorized" });
            if (!other_user_id)
                return res.status(400).json({ message: "other_user_id is required" });

            const conversationId = [String(user_id), String(other_user_id)]
                .sort()
                .join("_");
            const data = await messagesServices.getMessagesByQuery({
                page: Number(page),
                limit: Number(limit),
                conversationId,
                search,
                sort,
            });
            return res.json(data);
        } catch (e) {
            return res
                .status(500)
                .json({ message: e.message || "Failed to get messages" });
        }
    },
    /**
     * Me: send a message to another user
     */
    async sendMyMessage(req, res) {
        try {
            const { user_id } = req.user || {};
            if (!user_id) return res.status(401).json({ message: "Unauthorized" });
            const { other_user_id, message, attachments, tmpId } = req.body || {};
            if (!other_user_id)
                return res.status(400).json({ message: "other_user_id is required" });
            if (!message || !String(message).trim())
                return res.status(400).json({ message: "message is required" });

            // Basic sanitization (server will store plain text)
            const safeMsg = String(message)
                .replace(/[\r\n]{3,}/g, "\n\n")
                .slice(0, 5000);
            const io = req.app && req.app.get && req.app.get("io");
            const result = await messagesServices.createMessage(
                {
                    sender_user_id: user_id,
                    recipient_user_id: other_user_id,
                    message: safeMsg,
                    attachments: Array.isArray(attachments) ? attachments : [],
                    tmpId: tmpId || null,
                },
                io
            );
            return res.status(201).json(result);
        } catch (e) {
            return res
                .status(500)
                .json({ message: e.message || "Failed to send message" });
        }
    },
    /**
     * Admin: search tenants (TENANT role) with basic filters
     */
    async adminSearchTenants(req, res) {
        try {
            const { role } = req.user || {};
            if (!isAdminLike(role))
                return res.status(403).json({ message: "Forbidden" });

            const {
                page = 1,
                limit = 10,
                search,
                status,
                sort,
                ...rest
            } = req.query || {};
            const data = await usersServices.getUsers({
                page: Number(page),
                limit: Number(limit),
                search,
                status,
                sort,
                ...rest,
            });
            return res.json(data);
        } catch (e) {
            return res
                .status(500)
                .json({ message: e.message || "Failed to search tenants" });
        }
    },
    /**
     * Admin: list tickets with filters
     */
    async adminListTickets(req, res) {
        try {
            const { role } = req.user || {};
            if (!isAdminLike(role))
                return res.status(403).json({ message: "Forbidden" });

            const {
                page = 1,
                limit = 10,
                status,
                priority,
                request_type,
                from_date,
                to_date,
                search,
            } = req.query || {};
            const result = await ticketsServices.getTickets({
                page,
                limit,
                status,
                priority,
                request_type,
                from_date,
                to_date,
                search,
            });
            return res.json(result);
        } catch (e) {
            return res
                .status(500)
                .json({ message: e.message || "Failed to list tickets" });
        }
    },
    /**
     * Admin: aggregate/search charges across leases/tenants
     */
    async adminSearchCharges(req, res) {
        try {
            const { role } = req.user || {};
            if (!isAdminLike(role))
                return res.status(403).json({ message: "Forbidden" });

            const data = await chargesServices.getAllCharges(req.query || {});
            return res.json(data);
        } catch (e) {
            return res
                .status(500)
                .json({ message: e.message || "Failed to search charges" });
        }
    },
    /**
     * Admin: aggregate/search payments
     */
    async adminSearchPayments(req, res) {
        try {
            const { role } = req.user || {};
            if (!isAdminLike(role))
                return res.status(403).json({ message: "Forbidden" });
            const data = await paymentsServices.getAllPayments(req.query || {});
            return res.json(data);
        } catch (e) {
            return res
                .status(500)
                .json({ message: e.message || "Failed to search payments" });
        }
    },
    /**
     * Admin: get one tenant's charges and payments
     */
    async adminGetTenantFinancials(req, res) {
        try {
            const { role } = req.user || {};
            if (!isAdminLike(role))
                return res.status(403).json({ message: "Forbidden" });
            const { user_id } = req.params;
            if (!user_id)
                return res.status(400).json({ message: "user_id is required" });

            const { status, page = 1, limit = 10 } = req.query || {};
            const charges = await chargesServices.getChargeByUserId(user_id);
            const filteredCharges =
                status && String(status).toLowerCase() !== "all"
                    ? charges.filter(
                        (c) =>
                            String(c.canonical_status).toUpperCase() ===
                            String(status).toUpperCase()
                    )
                    : charges;
            const payments = await paymentsServices.getPaymentsByUserId(user_id, {
                page,
                limit,
            });
            return res.json({ charges: filteredCharges, payments });
        } catch (e) {
            return res
                .status(500)
                .json({ message: e.message || "Failed to get tenant financials" });
        }
    },
    /**
     * Admin: get charges for a lease
     */
    async adminGetLeaseCharges(req, res) {
        try {
            const { role } = req.user || {};
            if (!isAdminLike(role))
                return res.status(403).json({ message: "Forbidden" });
            const { lease_id } = req.params;
            if (!lease_id)
                return res.status(400).json({ message: "lease_id is required" });
            const rows = await chargesServices.getChargeByLeaseId(
                lease_id,
                req.query || {}
            );
            return res.json({ charges: rows });
        } catch (e) {
            return res
                .status(500)
                .json({ message: e.message || "Failed to get lease charges" });
        }
    },
    /**
     * Admin: create a charge (single or set up recurring)
     */
    async adminCreateCharge(req, res) {
        try {
            const { role, user_id: performedBy } = req.user || {};
            if (!isAdminLike(role))
                return res.status(403).json({ message: "Forbidden" });
            const payload = req.body || {};
            if (!payload.lease_id)
                return res.status(400).json({ message: "lease_id is required" });
            if (!payload.amount || Number(payload.amount) <= 0)
                return res.status(400).json({ message: "amount must be > 0" });
            const result = await chargesServices.createCharge(payload);
            return res
                .status(201)
                .json({ message: "Charge created", charge: result });
        } catch (e) {
            return res
                .status(500)
                .json({ message: e.message || "Failed to create charge" });
        }
    },
    /**
     * Admin: create a payment (optionally consolidated via allocations)
     */
    async adminCreatePayment(req, res) {
        try {
            const { role, user_id: performedBy } = req.user || {};
            if (!isAdminLike(role))
                return res.status(403).json({ message: "Forbidden" });
            const payload = req.body || {};
            const hasAlloc =
                Array.isArray(payload.allocations) && payload.allocations.length > 0;
            if (hasAlloc) {
                const result = await paymentsServices.createConsolidatedPayment(
                    payload,
                    performedBy
                );
                return res.status(201).json(result);
            }
            const result = await paymentsServices.createPayment(payload, performedBy);
            return res.status(201).json(result);
        } catch (e) {
            return res
                .status(500)
                .json({ message: e.message || "Failed to create payment" });
        }
    },
    /**
     * Admin: update payment status/details (confirm/reject/pending), and optional fields
     */
    async adminUpdatePayment(req, res) {
        try {
            const { role, user_id: performedBy } = req.user || {};
            if (!isAdminLike(role))
                return res.status(403).json({ message: "Forbidden" });
            const { payment_id } = req.params;
            if (!payment_id)
                return res.status(400).json({ message: "payment_id is required" });
            const result = await paymentsServices.updatePaymentById(
                payment_id,
                req.body || {},
                performedBy
            );
            return res.json(result);
        } catch (e) {
            return res
                .status(500)
                .json({ message: e.message || "Failed to update payment" });
        }
    },
    /**
     * Admin: delete payment
     */
    async adminDeletePayment(req, res) {
        try {
            const { role, user_id: performedBy } = req.user || {};
            if (!isAdminLike(role))
                return res.status(403).json({ message: "Forbidden" });
            const { payment_id } = req.params;
            if (!payment_id)
                return res.status(400).json({ message: "payment_id is required" });
            const result = await paymentsServices.deletePaymentById(
                payment_id,
                performedBy
            );
            return res.json(result);
        } catch (e) {
            return res
                .status(500)
                .json({ message: e.message || "Failed to delete payment" });
        }
    },
    /**
     * Admin: update charge (e.g., description, due_date, status)
     */
    async adminUpdateCharge(req, res) {
        try {
            const { role } = req.user || {};
            if (!isAdminLike(role))
                return res.status(403).json({ message: "Forbidden" });
            const { charge_id } = req.params;
            if (!charge_id)
                return res.status(400).json({ message: "charge_id is required" });
            const updated = await chargesServices.updateChargeById(
                charge_id,
                req.body || {}
            );
            return res.json({ message: "Charge updated", charge: updated });
        } catch (e) {
            return res
                .status(500)
                .json({ message: e.message || "Failed to update charge" });
        }
    },
    /**
     * Admin: waive a charge (sets status to Waived)
     */
    async adminWaiveCharge(req, res) {
        try {
            const { role } = req.user || {};
            if (!isAdminLike(role))
                return res.status(403).json({ message: "Forbidden" });
            const { charge_id } = req.params;
            if (!charge_id)
                return res.status(400).json({ message: "charge_id is required" });
            const updated = await chargesServices.updateChargeById(charge_id, {
                status: "Waived",
            });
            return res.json({ message: "Charge waived", charge: updated });
        } catch (e) {
            return res
                .status(500)
                .json({ message: e.message || "Failed to waive charge" });
        }
    },
    /** Reports: financial summary (admin) */
    async adminReportFinancial(req, res) {
        try {
            const { role } = req.user || {};
            if (!isAdminLike(role)) return res.status(403).json({ message: 'Forbidden' });
            const data = await reportsServices.getFinancialSummary(req.query || {});
            return res.json(data);
        } catch (e) { return res.status(500).json({ message: e.message || 'Failed to get financial summary' }); }
    },
    /** Reports: tenant summary (admin) */
    async adminReportTenants(req, res) {
        try {
            const { role } = req.user || {};
            if (!isAdminLike(role)) return res.status(403).json({ message: 'Forbidden' });
            const data = await reportsServices.getTenantSummary(req.query || {});
            return res.json(data);
        } catch (e) { return res.status(500).json({ message: e.message || 'Failed to get tenant summary' }); }
    },
    /** Reports: property/lease summary (admin) */
    async adminReportProperties(req, res) {
        try {
            const { role } = req.user || {};
            if (!isAdminLike(role)) return res.status(403).json({ message: 'Forbidden' });
            const data = await reportsServices.getPropertyLeaseSummary(req.query || {});
            return res.json(data);
        } catch (e) { return res.status(500).json({ message: e.message || 'Failed to get property/lease summary' }); }
    },
    /** Reports: maintenance summary (admin) */
    async adminReportMaintenance(req, res) {
        try {
            const { role } = req.user || {};
            if (!isAdminLike(role)) return res.status(403).json({ message: 'Forbidden' });
            const data = await reportsServices.getMaintenanceSummary(req.query || {});
            return res.json(data);
        } catch (e) { return res.status(500).json({ message: e.message || 'Failed to get maintenance summary' }); }
    },
    async getMyLease(req, res) {
        try {
            const { user_id } = req.user || {};
            const leases = await leaseServices.getLeaseByUserId(user_id);

            const sorted = (leases || [])
                .slice()
                .sort(
                    (a, b) =>
                        new Date(b.lease_start_date || 0) -
                        new Date(a.lease_start_date || 0)
                );
            const current =
                sorted.find((l) => String(l.lease_status).toUpperCase() === "ACTIVE") ||
                sorted.find(
                    (l) => String(l.lease_status).toUpperCase() === "PENDING"
                ) ||
                sorted[0] ||
                null;
            return res.json({ current, all: leases });
        } catch (e) {
            return res
                .status(500)
                .json({ message: e.message || "Failed to get lease" });
        }
    },
    async getMyCharges(req, res) {
        try {
            const { user_id } = req.user || {};
            const { status } = req.query || {};
            const rows = await chargesServices.getChargeByUserId(user_id);
            const filtered =
                status && String(status).toLowerCase() !== "all"
                    ? rows.filter(
                        (r) =>
                            String(r.canonical_status).toUpperCase() ===
                            String(status).toUpperCase()
                    )
                    : rows;
            const summary = {
                total: filtered.length,
                outstanding: filtered.filter(
                    (r) =>
                        String(r.canonical_status).toUpperCase() !== "PAID" &&
                        String(r.canonical_status).toUpperCase() !== "WAIVED"
                ).length,
                overdue: filtered.filter(
                    (r) =>
                        new Date(r.due_date) < new Date() &&
                        (r.canonical_status || "").toUpperCase() !== "PAID"
                ).length,
                totalAmount: filtered.reduce((s, r) => s + Number(r.amount || 0), 0),
                totalPaid: filtered.reduce((s, r) => s + Number(r.total_paid || 0), 0),
            };
            return res.json({ charges: filtered, summary });
        } catch (e) {
            return res
                .status(500)
                .json({ message: e.message || "Failed to get charges" });
        }
    },
    async getMyPayments(req, res) {
        try {
            const { user_id } = req.user || {};
            const { page = 1, limit = 10 } = req.query;
            const data = await paymentsServices.getPaymentsByUserId(user_id, {
                page,
                limit,
            });
            return res.json(data);
        } catch (e) {
            return res
                .status(500)
                .json({ message: e.message || "Failed to get payments" });
        }
    },
    async getFaqs(req, res) {
        try {
            const rows = await faqsServices.getAllFaqs();
            const faqs = (rows || [])
                .filter((r) => r.is_active === 1 || r.is_active === true)
                .map((r) => ({ id: r.faq_id, question: r.question, answer: r.answer }));
            return res.json({ faqs });
        } catch (e) {
            return res
                .status(500)
                .json({ message: e.message || "Failed to get FAQs" });
        }
    },
    async getMessagesSummary(req, res) {
        try {
            const { user_id } = req.user || {};
            const convs = await messagesServices.getConversations(user_id);
            const sorted = (convs || [])
                .slice()
                .sort(
                    (a, b) =>
                        new Date(b.last_message_time || 0) -
                        new Date(a.last_message_time || 0)
                );
            const top = sorted.slice(0, 5).map((c) => ({
                other_user_id: c.other_user_id,
                other_user_name: c.other_user_name,
                last_message: c.last_message,
                last_message_time: c.last_message_time,
            }));
            return res.json({ count: convs?.length || 0, recent: top });
        } catch (e) {
            return res
                .status(500)
                .json({ message: e.message || "Failed to get messages summary" });
        }
    },
};
