import { v4 as uuidv4 } from "uuid";
import conn from "../config/db.js";
import propertiesServices from "./propertiesServices.js";
import notificationsServices from "./notificationsServices.js";
import chargesServices from "./chargesServices.js";

const pool = await conn();

const getLeaseDefaults = async () => {
  const [rows] = await pool.query(
    `SELECT setting_key, setting_value FROM lease_default_values`
  );
  const defaults = {};
  rows.forEach((row) => {
    defaults[row.setting_key] = row.setting_value;
  });
  return defaults;
};

const createLease = async (leaseData = {}, contractFile = null, io = null) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existingLeaseRows] = await conn.query(
      "SELECT lease_id FROM leases WHERE property_id = ? AND (lease_status = 'ACTIVE' OR lease_status = 'PENDING')",
      [leaseData.property_id]
    );
    if (existingLeaseRows.length > 0) {
      await conn.rollback();
      conn.release();
      throw new Error("This property already has an active/pending lease.");
    }

    const defaults = await getLeaseDefaults();

    let lease_contract_id = null;
    if (contractFile) {
      const contractUrl =
        contractFile.location || contractFile.path || contractFile.url;
      const [contractResult] = await conn.query(
        `INSERT INTO lease_contracts (url, created_at) VALUES (?, NOW())`,
        [contractUrl]
      );
      lease_contract_id = contractResult.insertId;
    } else if (leaseData.contract_url) {
      const [contractResult] = await conn.query(
        `INSERT INTO lease_contracts (url, created_at) VALUES (?, NOW())`,
        [leaseData.contract_url]
      );
      lease_contract_id = contractResult.insertId;
    }

    const lease_id = leaseData.lease_id || uuidv4();

    const allowedColumns = new Set([
      "lease_id",
      "user_id",
      "property_id",

      "lease_start_date",
      "lease_end_date",
      "renewal_count",
      "parent_lease_id",

      "monthly_rent",
      "lease_status",

      "security_deposit_months",
      "advance_payment_months",
      "payment_frequency",
      "quarterly_tax_percentage",
      "lease_term_months",
      "late_fee_percentage",
      "grace_period_days",
      "is_security_deposit_refundable",
      "auto_termination_after_months",
      "advance_payment_forfeited_on_cancel",
      "termination_trigger_days",
      "notice_before_cancel_days",
      "notice_before_renewal_days",
      "rent_increase_on_renewal",

      "notes",
      "lease_contract_id",
    ]);

    const newLease = {
      lease_id,
      user_id: leaseData.user_id,
      property_id: leaseData.property_id,
      lease_start_date: leaseData.lease_start_date,
      lease_end_date: leaseData.lease_end_date,
      renewal_count: leaseData.renewal_count || 0,
      parent_lease_id: leaseData.parent_lease_id,
      monthly_rent: leaseData.monthly_rent,
      lease_status: leaseData.lease_status,
      notes: leaseData.notes,
      lease_contract_id,
    };

    const optionalColumns = [
      "security_deposit_months",
      "advance_payment_months",
      "payment_frequency",
      "quarterly_tax_percentage",
      "lease_term_months",
      "late_fee_percentage",
      "grace_period_days",
      "is_security_deposit_refundable",
      "auto_termination_after_months",
      "advance_payment_forfeited_on_cancel",
      "termination_trigger_days",
      "notice_before_cancel_days",
      "notice_before_renewal_days",
      "rent_increase_on_renewal",
    ];
    for (const key of optionalColumns) {
      if (leaseData[key] !== undefined && leaseData[key] !== null) {
        newLease[key] = leaseData[key];
      } else if (defaults[key] !== undefined && defaults[key] !== null) {
        newLease[key] = defaults[key];
      }
    }

    Object.keys(newLease).forEach((key) => {
      if (!allowedColumns.has(key) || newLease[key] === undefined) {
        delete newLease[key];
      }
    });

    const fields = Object.keys(newLease).join(", ");
    const placeholders = Object.keys(newLease)
      .map(() => "?")
      .join(", ");
    const values = Object.values(newLease);

    await conn.query(
      `INSERT INTO leases (${fields}) VALUES (${placeholders})`,
      values
    );

    let newPropertyStatus = null;
    if (leaseData.lease_status === "PENDING") {
      newPropertyStatus = "Reserved";
    } else if (leaseData.lease_status === "ACTIVE") {
      newPropertyStatus = "Occupied";
    }

    await conn.commit();
    conn.release();

    if (newPropertyStatus) {
      await propertiesServices.editPropertyById(leaseData.property_id, {
        property_status: newPropertyStatus,
      });
    }

    try {
      if (leaseData.user_id) {
        await notificationsServices.createNotification(
          {
            user_id: leaseData.user_id,
            type: "LEASE",
            title: "Lease Created",
            body: `Your lease has been created with status ${leaseData.lease_status}.`,
            link: "/leaseTenant.html",
            meta: { lease_id },
          },
          io
        );
      }
    } catch (notifyErr) {
      console.warn("Failed to create lease creation notification", notifyErr);
    }

    try {
      const advMonths = Number(leaseData.advance_payment_months || 0);
      const secMonths = Number(leaseData.security_deposit_months || 0);
      const startDate = leaseData.lease_start_date;
      const monthlyRentAmount = Number(leaseData.monthly_rent || 0);

      const createdChargeIds = [];

      if (advMonths > 0 && startDate) {
        for (let i = 1; i <= advMonths; i++) {
          try {
            const result = await chargesServices.createCharge({
              lease_id,
              charge_type: "Other",
              description: `Advance Payment - ${i} of ${advMonths}`,
              amount: monthlyRentAmount,
              charge_date: startDate,
              due_date: startDate,
              is_recurring: 0,
              status: "Pending",
            });
            createdChargeIds.push(result.charge_id);
          } catch (e) {
            console.warn("Failed to create advance payment charge", i, e);
          }
        }
      }

      if (secMonths > 0 && startDate) {
        for (let i = 1; i <= secMonths; i++) {
          try {
            const result = await chargesServices.createCharge({
              lease_id,
              charge_type: "Others",
              description: `Security Deposit - ${i} of ${secMonths}`,
              amount: monthlyRentAmount,
              charge_date: startDate,
              due_date: startDate,
              is_recurring: 0,
              status: "Pending",
            });
            createdChargeIds.push(result.charge_id);
          } catch (e) {
            console.warn("Failed to create security deposit charge", i, e);
          }
        }
      }

      try {
        const [adminRows] = await pool.query(
          "SELECT user_id FROM users WHERE role IN ('ADMIN','SUPERADMIN', 'MANAGER')"
        );
        const chargeSummaryParts = [];
        if (advMonths > 0)
          chargeSummaryParts.push(`${advMonths} advance payment`);
        if (secMonths > 0)
          chargeSummaryParts.push(`${secMonths} security deposit`);
        const summary = chargeSummaryParts.length
          ? chargeSummaryParts.join(" & ")
          : "No initial";
        for (const admin of adminRows) {
          try {
            await notificationsServices.createNotification(
              {
                user_id: admin.user_id,
                type: "CHARGE",
                title: "Initial Lease Charges Created",
                body: `${summary} charge(s) generated for lease ${lease_id}.`,
                link: "/chargesAdmin.html",
                meta: { lease_id, charge_ids: createdChargeIds },
              },
              io
            );
          } catch (e) {
            console.warn(
              "Failed to notify admin of initial charges",
              admin.user_id,
              e
            );
          }
        }
      } catch (e) {
        console.warn("Failed to fetch admin users for charge notifications", e);
      }
    } catch (chargeErr) {
      console.warn(
        "Automatic initial charge creation encountered errors",
        chargeErr
      );
    }

    return { message: "Lease created successfully", lease_id };
  } catch (error) {
    await conn.rollback();
    conn.release();
    throw error;
  }
};

const getAllLeases = async (queryObj = {}) => {
  try {
    let query = `
      SELECT 
        l.*,
        CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name, u.suffix) AS tenant_name,
        u.user_id,
        p.property_name,
        p.property_id,
        p.display_image
      FROM leases l
      LEFT JOIN users u ON l.user_id = u.user_id
      LEFT JOIN properties p ON l.property_id = p.property_id
      WHERE 1=1
    `;

    const values = [];

    if (queryObj.status && queryObj.status !== "all") {
      query += ` AND l.lease_status = ?`;
      values.push(queryObj.status);
    }

    if (queryObj.property_id && queryObj.property_id !== "all") {
      query += ` AND l.property_id = ?`;
      values.push(queryObj.property_id);
    }

    if (queryObj.user_id && queryObj.user_id !== "all") {
      query += ` AND l.user_id = ?`;
      values.push(queryObj.user_id);
    }

    if (queryObj.search) {
      query += ` AND (
        CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name, u.suffix) LIKE ?
        OR p.property_name LIKE ?
      )`;
      const searchTerm = `%${queryObj.search}%`;
      values.push(searchTerm, searchTerm);
    }

    if (queryObj.date) {
      query += ` AND (l.lease_start_date <= ? AND l.lease_end_date >= ?)`;
      values.push(queryObj.date, queryObj.date);
    }

    if (queryObj.min_rent) {
      query += ` AND l.monthly_rent >= ?`;
      values.push(parseFloat(queryObj.min_rent));
    }
    if (queryObj.max_rent) {
      query += ` AND l.monthly_rent <= ?`;
      values.push(parseFloat(queryObj.max_rent));
    }

    query += ` ORDER BY l.created_at DESC`;

    const page = parseInt(queryObj.page) > 0 ? parseInt(queryObj.page) : 1;
    const limit = parseInt(queryObj.limit) > 0 ? parseInt(queryObj.limit) : 10;
    const offset = (page - 1) * limit;

    query += ` LIMIT ? OFFSET ?`;
    values.push(limit, offset);

    const [rows] = await pool.query(query, values);

    let countQuery = `
      SELECT COUNT(DISTINCT l.lease_id) as total
      FROM leases l
      LEFT JOIN users u ON l.user_id = u.user_id
      LEFT JOIN properties p ON l.property_id = p.property_id
      WHERE 1=1
    `;
    const countValues = [];

    if (queryObj.status && queryObj.status !== "all") {
      countQuery += ` AND l.lease_status = ?`;
      countValues.push(queryObj.status);
    }
    if (queryObj.property_id && queryObj.property_id !== "all") {
      countQuery += ` AND l.property_id = ?`;
      countValues.push(queryObj.property_id);
    }
    if (queryObj.user_id && queryObj.user_id !== "all") {
      countQuery += ` AND l.user_id = ?`;
      countValues.push(queryObj.user_id);
    }
    if (queryObj.search) {
      countQuery += ` AND (
        CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name, u.suffix) LIKE ?
        OR p.property_name LIKE ?
      )`;
      const searchTerm = `%${queryObj.search}%`;
      countValues.push(searchTerm, searchTerm);
    }
    if (queryObj.date) {
      countQuery += ` AND (l.lease_start_date <= ? AND l.lease_end_date >= ?)`;
      countValues.push(queryObj.date, queryObj.date);
    }
    if (queryObj.min_rent) {
      countQuery += ` AND l.monthly_rent >= ?`;
      countValues.push(parseFloat(queryObj.min_rent));
    }
    if (queryObj.max_rent) {
      countQuery += ` AND l.monthly_rent <= ?`;
      countValues.push(parseFloat(queryObj.max_rent));
    }

    const [countResult] = await pool.query(countQuery, countValues);

    return {
      leases: rows,
      total: countResult[0].total,
      page,
      limit,
    };
  } catch (error) {
    console.error("Error getting leases:", error);
    throw new Error(error.message || "Failed to get leases");
  }
};

const getSingleLeaseById = async (leaseId) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT 
        l.*,
        CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name, u.suffix) AS tenant_name,
        u.user_id,
        u.phone_number,
        u.alt_phone_number,
        p.property_name,
        p.property_id,
        a.building_name,
        a.address_id,
        a.street,
        a.city,
        a.postal_code,
        a.country
      FROM leases l
      LEFT JOIN users u ON l.user_id = u.user_id
      LEFT JOIN properties p ON l.property_id = p.property_id
      LEFT JOIN addresses a ON p.address_id = a.address_id
      WHERE l.lease_id = ?
      LIMIT 1
    `,
      [leaseId]
    );
    if (rows.length === 0) throw new Error("Lease not found");
    const lease = rows[0];

    let contract = null;
    if (lease.lease_contract_id) {
      const [contractRows] = await pool.query(
        `SELECT * FROM lease_contracts WHERE lease_contract_id = ?`,
        [lease.lease_contract_id]
      );
      contract = contractRows[0] || null;
    }

    let termination = null;
    try {
      const [tRows] = await pool.query(
        `SELECT * FROM lease_termination WHERE lease_id = ? ORDER BY termination_id DESC LIMIT 1`,
        [leaseId]
      );
      if (tRows.length) termination = tRows[0];
    } catch (e) {
      console.warn("Failed to fetch termination record for lease", leaseId, e);
    }

    let renewal_history = [];
    try {
      const [rRows] = await pool.query(
        `SELECT renewal_id, previous_end_date, new_end_date, previous_rent, new_rent, rent_increase_pct, notes, created_at FROM lease_renewals WHERE lease_id = ? ORDER BY renewal_id DESC`,
        [leaseId]
      );
      renewal_history = rRows;
    } catch (e) {
      console.warn("Failed to fetch renewal history for lease", leaseId, e);
    }
    return { ...lease, contract, termination, renewal_history };
  } catch (error) {
    throw error;
  }
};

const getLeaseByUserId = async (userId) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT l.*, p.property_name, p.property_id, p.display_image,
        a.address_id, a.building_name, a.street, a.city, a.postal_code, a.country
      FROM leases l
      LEFT JOIN properties p ON l.property_id = p.property_id
      LEFT JOIN addresses a ON p.address_id = a.address_id
      WHERE l.user_id = ?
    `,
      [userId]
    );
    return rows;
  } catch (error) {
    throw error;
  }
};

const updateLeaseById = async (
  leaseId,
  leaseData = {},
  contractFile = null,
  io = null
) => {
  if (!leaseId) throw new Error("Lease ID is required");

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const lease = await getSingleLeaseById(leaseId);

    let lease_contract_id = lease.lease_contract_id;

    if (contractFile) {
      const contractUrl =
        contractFile.location || contractFile.path || contractFile.url;

      if (lease_contract_id) {
        await conn.query(
          `UPDATE lease_contracts SET url = ?, updated_at = NOW() WHERE lease_contract_id = ?`,
          [contractUrl, lease_contract_id]
        );
      } else {
        const [contractResult] = await conn.query(
          `INSERT INTO lease_contracts (url, created_at) VALUES (?, NOW())`,
          [contractUrl]
        );
        lease_contract_id = contractResult.insertId;
      }
    }

    const allowedFields = [
      "user_id",
      "property_id",
      "lease_start_date",
      "lease_end_date",
      "renewal_count",
      "parent_lease_id",
      "monthly_rent",
      "lease_status",
      "security_deposit_months",
      "advance_payment_months",
      "payment_frequency",
      "quarterly_tax_percentage",
      "lease_term_months",
      "late_fee_percentage",
      "grace_period_days",
      "is_security_deposit_refundable",
      "auto_termination_after_months",
      "advance_payment_forfeited_on_cancel",
      "termination_trigger_days",
      "notice_before_cancel_days",
      "notice_before_renewal_days",
      "rent_increase_on_renewal",
      "notes",
    ];

    const updatedLease = {};
    for (const key of allowedFields) {
      if (leaseData[key] !== undefined && leaseData[key] !== null) {
        updatedLease[key] = leaseData[key];
      }
    }
    if (contractFile && lease_contract_id) {
      updatedLease.lease_contract_id = lease_contract_id;
    }

    if (Object.keys(updatedLease).length > 0) {
      const fields = Object.keys(updatedLease)
        .map((key) => `\`${key}\` = ?`)
        .join(", ");
      const values = Object.values(updatedLease);
      await conn.query(
        `UPDATE leases SET ${fields}, updated_at = NOW() WHERE lease_id = ?`,
        [...values, leaseId]
      );
    }

    let newPropertyStatus = null;
    if (leaseData.lease_status === "PENDING") {
      newPropertyStatus = "Reserved";
    } else if (leaseData.lease_status === "ACTIVE") {
      newPropertyStatus = "Occupied";
    } else if (
      leaseData.lease_status === "TERMINATED" ||
      leaseData.lease_status === "CANCELLED"
    ) {
      newPropertyStatus = "Available";
    }

    await conn.commit();
    conn.release();

    if (newPropertyStatus && lease.property_id) {
      await propertiesServices.editPropertyById(lease.property_id, {
        property_status: newPropertyStatus,
      });
    }

    try {
      if (
        lease &&
        lease.user_id &&
        leaseData.lease_status &&
        String(leaseData.lease_status).toUpperCase() !==
        String(lease.lease_status || "").toUpperCase()
      ) {
        await notificationsServices.createNotification(
          {
            user_id: lease.user_id,
            type: "LEASE",
            title: "Lease Status Updated",
            body: `Your lease status changed to ${leaseData.lease_status}.`,
            link: "/leaseTenant.html",
            meta: { lease_id: leaseId },
          },
          io
        );
      }
    } catch (notifyErr) {
      console.warn("Failed to create lease update notification", notifyErr);
    }

    return { message: "Lease updated successfully" };
  } catch (error) {
    await conn.rollback();
    conn.release();
    throw error;
  }
};

const deleteLeaseById = async (leaseId) => {
  try {
    const [result] = await pool.query(`DELETE FROM leases WHERE lease_id = ?`, [
      leaseId,
    ]);
    if (result.affectedRows === 0)
      throw new Error("Lease not found or not deleted");
    return { message: "Lease deleted successfully" };
  } catch (error) {
    throw error;
  }
};

const terminateLease = async (leaseId, terminationData = {}, io = null) => {
  if (!leaseId) throw new Error("Lease ID is required");
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [leaseRows] = await conn.query(
      `SELECT lease_id, user_id, property_id, lease_status FROM leases WHERE lease_id = ? LIMIT 1`,
      [leaseId]
    );
    if (leaseRows.length === 0) throw new Error("Lease not found");
    const lease = leaseRows[0];

    const status = String(lease.lease_status || "").toUpperCase();
    if (["TERMINATED", "CANCELLED"].includes(status)) {
      throw new Error("Lease already terminated/cancelled");
    }
    if (status === "PENDING") {
    } else if (status !== "ACTIVE" && status !== "EXPIRED") {
      throw new Error(
        "Only ACTIVE, EXPIRED or PENDING leases can be terminated"
      );
    }

    const allowedReasons = [
      "Cancellation",
      "Non-payment",
      "End-of-term",
      "Other",
    ];
    const allowedAdvanceStatuses = ["Applied to rent", "Forfeited", "Refunded"];
    const allowedSecurityStatuses = ["Refunded", "Forfeited", "Held"];

    const termination_reason =
      terminationData.termination_reason &&
        allowedReasons.includes(terminationData.termination_reason)
        ? terminationData.termination_reason
        : "Other";
    const advance_payment_status =
      terminationData.advance_payment_status &&
        allowedAdvanceStatuses.includes(terminationData.advance_payment_status)
        ? terminationData.advance_payment_status
        : "Applied to rent";
    const security_deposit_status =
      terminationData.security_deposit_status &&
        allowedSecurityStatuses.includes(terminationData.security_deposit_status)
        ? terminationData.security_deposit_status
        : "Held";
    const termination_date =
      terminationData.termination_date ||
      new Date().toISOString().split("T")[0];
    const notes = terminationData.notes || null;

    const [insResult] = await conn.query(
      `INSERT INTO lease_termination (lease_id, termination_date, termination_reason, advance_payment_status, security_deposit_status, notes) VALUES (?,?,?,?,?,?)`,
      [
        leaseId,
        termination_date,
        termination_reason,
        advance_payment_status,
        security_deposit_status,
        notes,
      ]
    );
    const termination_id = insResult.insertId;

    await conn.query(
      `UPDATE leases SET lease_status = 'TERMINATED', updated_at = NOW() WHERE lease_id = ?`,
      [leaseId]
    );

    if (lease.property_id) {
      try {
        await propertiesServices.editPropertyById(lease.property_id, {
          property_status: "Available",
        });
      } catch (e) {
        console.warn("Property status update failed after termination", e);
      }
    }

    await conn.commit();
    conn.release();

    try {
      if (lease.user_id) {
        await notificationsServices.createNotification(
          {
            user_id: lease.user_id,
            type: "LEASE",
            title: "Lease Terminated",
            body: `Your lease has been terminated (Reason: ${termination_reason}).`,
            link: "/leaseTenant.html",
            meta: { lease_id: leaseId, termination_id },
          },
          io
        );
      }
    } catch (e) {
      console.warn("Failed to notify tenant of termination", e);
    }

    return {
      message: "Lease terminated successfully",
      lease_id: leaseId,
      termination_id,
    };
  } catch (error) {
    await conn.rollback();
    conn.release();
    throw error;
  }
};

const renewLease = async (leaseId, renewalData = {}, io = null) => {
  if (!leaseId) throw new Error("Lease ID is required");
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [leaseRows] = await conn.query(
      `SELECT * FROM leases WHERE lease_id = ? LIMIT 1`,
      [leaseId]
    );
    if (leaseRows.length === 0) throw new Error("Lease not found");
    const lease = leaseRows[0];
    const status = String(lease.lease_status || "").toUpperCase();
    if (status !== "ACTIVE" && status !== "EXPIRED") {
      throw new Error("Only ACTIVE or EXPIRED leases can be renewed");
    }

    const new_end_date = renewalData.new_end_date;
    if (!new_end_date || !/\d{4}-\d{2}-\d{2}/.test(new_end_date)) {
      throw new Error(
        "Valid new_end_date (YYYY-MM-DD) is required for renewal"
      );
    }
    const oldRent = Number(lease.monthly_rent || 0);
    const newMonthlyRent =
      renewalData.new_monthly_rent !== undefined &&
        renewalData.new_monthly_rent !== null
        ? Number(renewalData.new_monthly_rent)
        : oldRent;
    if (isNaN(newMonthlyRent) || newMonthlyRent <= 0) {
      throw new Error("Invalid new monthly rent");
    }
    let rentIncreasePct = 0;
    if (oldRent > 0) {
      rentIncreasePct = ((newMonthlyRent - oldRent) / oldRent) * 100;
    }
    rentIncreasePct = Math.round(rentIncreasePct * 100) / 100;

    const updatedNotes = renewalData.notes
      ? `${lease.notes ? lease.notes + "\n" : ""}Renewal: ${renewalData.notes}`
      : lease.notes;

    await conn.query(
      `UPDATE leases SET lease_end_date = ?, monthly_rent = ?, renewal_count = COALESCE(renewal_count,0) + 1, rent_increase_on_renewal = ?, lease_status = 'ACTIVE', updated_at = NOW(), notes = ? WHERE lease_id = ?`,
      [new_end_date, newMonthlyRent, rentIncreasePct, updatedNotes, leaseId]
    );

    try {
      await conn.query(
        `INSERT INTO lease_renewals (lease_id, previous_end_date, new_end_date, previous_rent, new_rent, rent_increase_pct, notes) VALUES (?,?,?,?,?,?,?)`,
        [
          leaseId,
          lease.lease_end_date && lease.lease_end_date.split
            ? lease.lease_end_date.split("T")[0]
            : lease.lease_end_date,
          new_end_date,
          oldRent,
          newMonthlyRent,
          rentIncreasePct,
          renewalData.notes || null,
        ]
      );
    } catch (e) {
      console.warn("Failed to insert renewal log for lease", leaseId, e);
    }

    await conn.commit();
    conn.release();

    try {
      if (lease.user_id) {
        await notificationsServices.createNotification(
          {
            user_id: lease.user_id,
            type: "LEASE",
            title: "Lease Renewed",
            body: `Your lease has been renewed. New end date: ${new_end_date}.`,
            link: "/leaseTenant.html",
            meta: { lease_id: leaseId },
          },
          io
        );
      }
    } catch (e) {
      console.warn("Failed to notify tenant of renewal", e);
    }

    return {
      message: "Lease renewed successfully",
      lease_id: leaseId,
      new_end_date,
      new_monthly_rent: newMonthlyRent,
      rent_increase_percentage: rentIncreasePct,
    };
  } catch (error) {
    await conn.rollback();
    conn.release();
    throw error;
  }
};

export default {
  createLease,
  getAllLeases,
  getSingleLeaseById,
  getLeaseByUserId,
  updateLeaseById,
  deleteLeaseById,
  terminateLease,
  renewLease,
};
