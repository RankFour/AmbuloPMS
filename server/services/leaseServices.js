import { v4 as uuidv4 } from "uuid";
import conn from "../config/db.js";
import propertiesServices from "./propertiesServices.js";

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

const createLease = async (leaseData = {}, contractFile = null) => {
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

    Object.keys(defaults).forEach((key) => {
      if (leaseData[key] === undefined || leaseData[key] === null) {
        newLease[key] = defaults[key];
      } else {
        newLease[key] = leaseData[key];
      }
    });

    Object.keys(newLease).forEach(
      (key) => newLease[key] === undefined && delete newLease[key]
    );

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
    if (newPropertyStatus) {
      await propertiesServices.editPropertyById(leaseData.property_id, { property_status: newPropertyStatus });
    }

    await conn.commit();
    conn.release();

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
        p.property_id
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
    const [rows] = await pool.query(`
      SELECT 
        l.*,
        CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name, u.suffix) AS tenant_name,
        u.user_id,
        p.property_name,
        p.property_id
      FROM leases l
      LEFT JOIN users u ON l.user_id = u.user_id
      LEFT JOIN properties p ON l.property_id = p.property_id
      WHERE l.lease_id = ?
      LIMIT 1
    `, [leaseId]);
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
    return { ...lease, contract };
  } catch (error) {
    throw error;
  }
};

const getLeaseByUserId = async (userId) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM leases WHERE user_id = ?`, [
      userId,
    ]);
    return rows;
  } catch (error) {
    throw error;
  }
};

const updateLeaseById = async (
  leaseId,
  leaseData = {},
  contractFile = null
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
    } else if (leaseData.lease_status === "TERMINATED" || leaseData.lease_status === "CANCELLED") {
      newPropertyStatus = "Available";
    }
    if (newPropertyStatus && lease.property_id) {
      await propertiesServices.editPropertyById(lease.property_id, { property_status: newPropertyStatus });
    }

    await conn.commit();
    conn.release();

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

export default {
  createLease,
  getAllLeases,
  getSingleLeaseById,
  getLeaseByUserId,
  updateLeaseById,
  deleteLeaseById,
};
