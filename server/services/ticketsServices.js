import { v4 as uuidv4 } from "uuid";
import conn from "./../config/db.js";
import notificationsServices from "./notificationsServices.js";

const pool = await conn();

const createTicket = async (
  ticketData = {},
  currentUserId = null,
  io = null
) => {
  const {
    ticket_title,
    description,
    priority,
    request_type,
    assigned_to,
    user_id,
    lease_id,
    phone_number,
    start_datetime,
    end_datetime,
    notes,
    maintenance_costs,
    attachments,
  } = ticketData || {};

  const ticket_id = uuidv4();
  const now = new Date();

  try {
    const finalUserId = user_id || currentUserId;

    let ticket_status;
    if (!assigned_to || assigned_to.trim() === "") {
      ticket_status = "PENDING";
    } else {
      ticket_status = "ASSIGNED";
    }

    const newTicket = {
      ticket_id,
      ticket_title,
      description,
      priority,
      request_type,
      assigned_to,
      user_id: finalUserId,
      lease_id,
      phone_number,
      ticket_status,
      start_datetime,
      end_datetime,
      notes,
      maintenance_costs,
      created_at: now,
      updated_at: now,
    };

    Object.keys(newTicket).forEach(
      (key) => newTicket[key] === undefined && delete newTicket[key]
    );

    const fields = Object.keys(newTicket).join(", ");
    const placeholders = Object.keys(newTicket)
      .map(() => "?")
      .join(", ");
    const values = Object.values(newTicket);

    const query = `INSERT INTO tickets (${fields}) VALUES (${placeholders})`;
    await pool.query(query, values);

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const attachQuery = `INSERT INTO ticket_attachments (ticket_id, url) VALUES ?`;
      const attachValues = attachments.map((url) => [ticket_id, url]);
      await pool.query(attachQuery, [attachValues]);
    }

    try {
      if (assigned_to && String(assigned_to).trim() !== "") {
        let recipient = finalUserId;
        try {
          const [rows] = await pool.query(
            `SELECT user_id FROM users WHERE user_id = ? LIMIT 1`,
            [assigned_to]
          );
          if (rows && rows.length) recipient = rows[0].user_id;
        } catch (e) { }

        await notificationsServices.createNotification(
          {
            user_id: recipient,
            type: "TICKET",
            title: "New Ticket Assigned",
            body: `Ticket: ${ticket_title || "Maintenance Request"}`,
            link: "/maintenance.html",
            meta: { ticket_id },
          },
          io
        );
      }
    } catch (notifyErr) {
      console.warn(
        "Failed to create ticket assignment notification",
        notifyErr
      );
    }

    return {
      message: "Ticket created successfully",
      ticket_id,
      ticketData: newTicket,
    };
  } catch (error) {
    console.error("Error creating ticket:", error);
    throw new Error(error.message || "Failed to create ticket");
  }
};

const updateTicketStatuses = async () => {
  try {
    const now = new Date();
    const currentDate = now.toISOString().split("T")[0];
    const currentTime = now.toTimeString().split(" ")[0];

    const checkQuery = `
      SELECT 
        ticket_id, 
        ticket_title, 
        ticket_status, 
        assigned_to,
        start_datetime,
        end_datetime
      FROM tickets 
      WHERE ticket_status IN ('ASSIGNED', 'PENDING')
        AND start_datetime IS NOT NULL
    `;

    const [eligibleTickets] = await pool.query(checkQuery);

    const updateToInProgressQuery = `
      UPDATE tickets 
      SET ticket_status = 'IN_PROGRESS', updated_at = NOW()
      WHERE ticket_status IN ('ASSIGNED', 'PENDING')
        AND assigned_to IS NOT NULL 
        AND assigned_to != ''
        AND start_datetime <= NOW()
        AND (end_datetime IS NULL OR end_datetime >= NOW())
    `;

    const [result] = await pool.query(updateToInProgressQuery);

    const updateToCompletedQuery = `
      UPDATE tickets 
      SET ticket_status = 'COMPLETED', updated_at = NOW()
      WHERE ticket_status = 'IN_PROGRESS'
        AND end_datetime IS NOT NULL
        AND end_datetime <= NOW()
    `;

    const [completedResult] = await pool.query(updateToCompletedQuery);

    return {
      message: "Ticket statuses updated successfully",
      inProgressCount: result.affectedRows,
      completedCount: completedResult.affectedRows,
      currentDate,
      currentTime,
      eligibleTickets: eligibleTickets.length,
    };
  } catch (error) {
    console.error("Error updating ticket statuses:", error);
    throw new Error(`Failed to update ticket statuses: ${error.message}`);
  }
};

const getTickets = async (queryObj = {}) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      request_type,
      from_date,
      to_date,
      search,
    } = queryObj;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    let query = `
      SELECT 
        t.*,
        CONCAT(u.first_name, ' ', u.last_name) as requested_by_name,
        u.email as requested_by_email,
        (
          SELECT JSON_ARRAYAGG(url) FROM ticket_attachments ta WHERE ta.ticket_id = t.ticket_id
        ) as attachments,
        p.property_name as property_name
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.user_id
      LEFT JOIN leases l ON t.lease_id = l.lease_id
      LEFT JOIN properties p ON l.property_id = p.property_id
      WHERE 1=1
    `;
    const params = [];

    if (
      status &&
      String(status).trim() !== "" &&
      String(status).toLowerCase() !== "all"
    ) {
      query += ` AND UPPER(t.ticket_status) = UPPER(?)`;
      params.push(status);
    }

    if (
      priority &&
      String(priority).trim() !== "" &&
      String(priority).toLowerCase() !== "all"
    ) {
      query += ` AND UPPER(t.priority) = UPPER(?)`;
      params.push(priority);
    }

    if (
      request_type &&
      String(request_type).trim() !== "" &&
      String(request_type).toLowerCase() !== "all"
    ) {
      query += ` AND UPPER(t.request_type) = UPPER(?)`;
      params.push(request_type);
    }

    if (from_date && to_date) {
      query += ` AND DATE(t.created_at) BETWEEN ? AND ?`;
      params.push(from_date, to_date);
    } else if (from_date) {
      query += ` AND DATE(t.created_at) >= ?`;
      params.push(from_date);
    } else if (to_date) {
      query += ` AND DATE(t.created_at) <= ?`;
      params.push(to_date);
    }

    if (search && search.trim() !== "") {
      query += ` AND (
        t.ticket_title LIKE ? OR
        t.description LIKE ? OR
        p.property_name LIKE ? OR
        CONCAT(u.first_name, ' ', u.last_name) LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += " ORDER BY t.created_at DESC";
    query += " LIMIT ? OFFSET ?";
    params.push(limitNum, skip);

    let countQuery = `
      SELECT COUNT(*) as total 
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.user_id
      LEFT JOIN leases l ON t.lease_id = l.lease_id
      LEFT JOIN properties p ON l.property_id = p.property_id
      WHERE 1=1
    `;
    const countParams = [];
    if (
      status &&
      String(status).trim() !== "" &&
      String(status).toLowerCase() !== "all"
    ) {
      countQuery += ` AND UPPER(t.ticket_status) = UPPER(?)`;
      countParams.push(status);
    }
    if (
      priority &&
      String(priority).trim() !== "" &&
      String(priority).toLowerCase() !== "all"
    ) {
      countQuery += ` AND UPPER(t.priority) = UPPER(?)`;
      countParams.push(priority);
    }
    if (
      request_type &&
      String(request_type).trim() !== "" &&
      String(request_type).toLowerCase() !== "all"
    ) {
      countQuery += ` AND UPPER(t.request_type) = UPPER(?)`;
      countParams.push(request_type);
    }
    if (from_date && to_date) {
      countQuery += ` AND DATE(t.created_at) BETWEEN ? AND ?`;
      countParams.push(from_date, to_date);
    } else if (from_date) {
      countQuery += ` AND DATE(t.created_at) >= ?`;
      countParams.push(from_date);
    } else if (to_date) {
      countQuery += ` AND DATE(t.created_at) <= ?`;
      countParams.push(to_date);
    }
    if (search && search.trim() !== "") {
      countQuery += ` AND (
        t.ticket_title LIKE ? OR
        t.description LIKE ? OR
        p.property_name LIKE ? OR
        CONCAT(u.first_name, ' ', u.last_name) LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const [rows] = await pool.query(query, params);

    const [countResult] = await pool.query(countQuery, countParams);
    const total = countResult[0].total;

    return {
      tickets: rows,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalTickets: total,
        hasNextPage: pageNum * limitNum < total,
        hasPrevPage: pageNum > 1,
      },
    };
  } catch (error) {
    console.error("Error fetching tickets:", error);
    throw new Error(error.message || "Failed to fetch tickets");
  }
};

const getSingleTicketById = async (ticket_id = "") => {
  try {
    const query = `
      SELECT 
        t.*,
        CONCAT(u.first_name, ' ', u.last_name) as requested_by_name,
        u.email as requested_by_email,
        (
          SELECT JSON_ARRAYAGG(url) FROM ticket_attachments ta WHERE ta.ticket_id = t.ticket_id
        ) as attachments,
        p.property_name as property_name
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.user_id
      LEFT JOIN leases l ON t.lease_id = l.lease_id
      LEFT JOIN properties p ON l.property_id = p.property_id
      WHERE t.ticket_id = ?
    `;
    const [rows] = await pool.query(query, [ticket_id]);

    if (rows.length === 0) {
      throw new Error("Ticket not found");
    }

    return {
      message: "Ticket retrieved successfully",
      ticket: rows[0],
    };
  } catch (error) {
    console.error("Error getting ticket:", error);
    throw new Error(error.message || "Failed to get ticket");
  }
};

const getTicketsByUserId = async (user_id = "", queryObj = {}) => {
  try {
    const { page = 1, limit = 10 } = queryObj;
    const skip = (page - 1) * limit;

    const query = `
      SELECT 
        t.*,
        CONCAT(u.first_name, ' ', u.last_name) as requested_by_name,
        u.email as requested_by_email,
        (
          SELECT JSON_ARRAYAGG(url) FROM ticket_attachments ta WHERE ta.ticket_id = t.ticket_id
        ) as attachments,
        p.property_name as property_name
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.user_id
      LEFT JOIN leases l ON t.lease_id = l.lease_id
      LEFT JOIN properties p ON l.property_id = p.property_id
      WHERE t.user_id = ? 
      ORDER BY t.created_at DESC 
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query(query, [
      user_id,
      parseInt(limit),
      parseInt(skip),
    ]);

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.user_id
      LEFT JOIN leases l ON t.lease_id = l.lease_id
      LEFT JOIN properties p ON l.property_id = p.property_id
      WHERE t.user_id = ?
    `;
    const [countResult] = await pool.query(countQuery, [user_id]);
    const total = countResult[0].total;

    return {
      message: "User tickets retrieved successfully",
      user_id,
      tickets: rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalTickets: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  } catch (error) {
    console.error("Error fetching user tickets:", error);
    throw new Error(error.message || "Failed to fetch user tickets");
  }
};

const updateTicketById = async (ticket_id = "", ticketData = {}, io = null) => {
  try {
    if (!ticket_id) {
      throw new Error("Ticket ID is required");
    }

    if (Object.keys(ticketData).length === 0) {
      throw new Error("No data provided for update");
    }

    const allowedFields = [
      "ticket_title",
      "description",
      "priority",
      "request_type",
      "assigned_to",
      "ticket_status",
      "start_datetime",
      "end_datetime",
      "maintenance_costs",
      "notes",
    ];

    const filteredData = {};
    Object.keys(ticketData).forEach((key) => {
      if (allowedFields.includes(key)) {
        filteredData[key] = ticketData[key];
      }
    });

    if (Object.keys(filteredData).length === 0) {
      throw new Error("No valid fields provided for update");
    }

    if (
      ticketData.attachments &&
      Array.isArray(ticketData.attachments) &&
      ticketData.attachments.length > 0
    ) {
      const existingQuery = `SELECT url FROM ticket_attachments WHERE ticket_id = ?`;
      const [existingAttachments] = await pool.query(existingQuery, [
        ticket_id,
      ]);
      const existingUrls = existingAttachments.map((att) => att.url);

      const allAttachments = [...existingUrls, ...ticketData.attachments];
      const maxFiles = 5;

      if (allAttachments.length > maxFiles) {
        throw new Error(
          `Total attachments cannot exceed ${maxFiles} files. Current: ${existingUrls.length} existing + ${ticketData.attachments.length} new = ${allAttachments.length}`
        );
      }

      await pool.query(`DELETE FROM ticket_attachments WHERE ticket_id = ?`, [
        ticket_id,
      ]);

      if (allAttachments.length > 0) {
        const attachQuery = `INSERT INTO ticket_attachments (ticket_id, url) VALUES ?`;
        const attachValues = allAttachments.map((url) => [ticket_id, url]);
        await pool.query(attachQuery, [attachValues]);
      }
    }

    let prevTicket = null;
    try {
      const [prevRows] = await pool.query(
        `SELECT ticket_id, ticket_title, ticket_status, user_id, assigned_to FROM tickets WHERE ticket_id = ? LIMIT 1`,
        [ticket_id]
      );
      prevTicket = prevRows && prevRows.length ? prevRows[0] : null;
    } catch { }

    const updatedData = {
      ...filteredData,
      updated_at: new Date(),
    };

    Object.keys(updatedData).forEach(
      (key) => updatedData[key] === undefined && delete updatedData[key]
    );

    const fields = Object.keys(updatedData);
    const setClause = fields.map((field) => `${field} = ?`).join(", ");
    const values = Object.values(updatedData);

    const query = `UPDATE tickets SET ${setClause} WHERE ticket_id = ?`;

    const [result] = await pool.query(query, [...values, ticket_id]);

    if (result.affectedRows === 0) {
      throw new Error("Ticket could not be updated");
    }

    const updatedTicket = await getSingleTicketById(ticket_id);

    try {
      if (prevTicket) {
        const newStatus =
          updatedTicket.ticket?.ticket_status || filteredData.ticket_status;
        if (
          newStatus &&
          String(newStatus).toUpperCase() !==
          String(prevTicket.ticket_status || "").toUpperCase()
        ) {
          if (prevTicket.user_id) {
            await notificationsServices.createNotification(
              {
                user_id: prevTicket.user_id,
                type: "TICKET",
                title: "Ticket Status Updated",
                body: `${prevTicket.ticket_title || "Your ticket"
                  } is now ${newStatus}.`,
                link: "/maintenanceTenant.html",
                meta: { ticket_id },
              },
              io
            );
          }
        }
        const newAssignee =
          filteredData.assigned_to || updatedTicket.ticket?.assigned_to;
        if (
          newAssignee &&
          String(newAssignee).trim() !== "" &&
          String(newAssignee) !== String(prevTicket.assigned_to || "")
        ) {
          let recipient = prevTicket.user_id || null;
          try {
            const [rows] = await pool.query(
              `SELECT user_id FROM users WHERE user_id = ? LIMIT 1`,
              [newAssignee]
            );
            if (rows && rows.length) recipient = rows[0].user_id;
          } catch (e) { }
          if (recipient) {
            await notificationsServices.createNotification(
              {
                user_id: recipient,
                type: "TICKET",
                title: "New Ticket Assigned",
                body: `${prevTicket.ticket_title || "A ticket"
                  } has been assigned.`,
                link: "/maintenance.html",
                meta: { ticket_id },
              },
              io
            );
          }
        }
      }
    } catch (notifyErr) {
      console.warn("Failed to create ticket update notification", notifyErr);
    }

    return {
      message: "Ticket updated successfully",
      ticket_id,
      ticket: updatedTicket.ticket,
      updatedFields: Object.keys(filteredData),
    };
  } catch (error) {
    console.error("Error updating ticket:", error);
    throw new Error(error.message || "Failed to update ticket");
  }
};

const deleteTicket = async (ticketId) => {
  try {
    const checkQuery = `SELECT ticket_id, ticket_title, ticket_status FROM tickets WHERE ticket_id = ?`;
    const [existingTickets] = await pool.query(checkQuery, [ticketId]);

    if (existingTickets.length === 0) {
      throw new Error("Ticket not found");
    }

    const ticket = existingTickets[0];

    if (ticket.ticket_status === "COMPLETED") {
      throw new Error(
        "Cannot delete completed tickets. Archive instead if needed."
      );
    }

    const deleteQuery = `DELETE FROM tickets WHERE ticket_id = ?`;
    const [result] = await pool.query(deleteQuery, [ticketId]);

    if (result.affectedRows === 0) {
      throw new Error("Failed to delete ticket");
    }

    return {
      message: "Ticket deleted successfully",
      ticket_id: ticketId,
      deletedTicket: {
        ticket_id: ticket.ticket_id,
        ticket_title: ticket.ticket_title,
        ticket_status: ticket.ticket_status,
      },
    };
  } catch (error) {
    console.error("Error deleting ticket:", error);
    throw new Error(error.message || "Failed to delete ticket");
  }
};

export default {
  createTicket,
  updateTicketStatuses,
  getTickets,
  getSingleTicketById,
  getTicketsByUserId,
  updateTicketById,
  deleteTicket,
};
