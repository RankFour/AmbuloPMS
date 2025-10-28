import expressAsync from "express-async-handler";
import ticketsServices from "../services/ticketsServices.js";

const createTicket = expressAsync(async (req, res) => {
  try {
    const attachments = req.files && req.files['attachments']
      ? req.files['attachments'].map(file => file.path)
      : [];

    const payload = {
      ...req.body,
      attachments
    };

    const io = req.app && req.app.get ? req.app.get('io') : null;
    const response = await ticketsServices.createTicket(payload, null, io);
    res.json(response);
  } catch (error) {
    console.error("Error creating ticket:", error);
    res.status(500).json({
      message: error.message || "Failed to create ticket"
    });
  }
});

const getTickets = expressAsync(async (req, res) => {
  try {
    const response = await ticketsServices.getTickets(req.query);
    res.json(response);
  } catch (error) {
    console.error("Error fetching tickets:", error);
    throw new Error(error.message || "Failed to fetch tickets");
  }
});

const getSingleTicketById = expressAsync(async (req, res) => {
  try {
    const response = await ticketsServices.getSingleTicketById(req.params.ticket_id);
    res.json(response);
  } catch (error) {
    console.error("Error getting ticket:", error);
    throw new Error(error.message || "Failed to get ticket");
  }
});

const getTicketsByUserId = expressAsync(async (req, res) => {
  try {
    const response = await ticketsServices.getTicketsByUserId(req.params.user_id);
    res.json(response);
  } catch (error) {
    console.error("Error fetching user tickets:", error);
    throw new Error(error.message || "Failed to fetch user tickets");
  }
});

const updateTicketStatuses = expressAsync(async (req, res) => {
  try {
    const response = await ticketsServices.updateTicketStatuses();
    res.json(response);
  } catch (error) {
    console.error("Error updating ticket statuses:", error);
    res.status(500).json({
      message: error.message || "Failed to update ticket statuses"
    });
  }
});

const updateTicketById = expressAsync(async (req, res) => {
  try {
    const attachments = req.files && req.files['attachments']
      ? req.files['attachments'].map(file => file.path)
      : [];

    let payload = { ...req.body };
    
    
    if (attachments.length > 0) {
      payload.attachments = attachments;
    }

    if (req.body.ticket_status === 'CANCELLED') {
      payload.ticket_status = 'CANCELLED';
    } else if (req.body.end_datetime) {
      payload.ticket_status = 'COMPLETED';
    } else if (req.body.assigned_to && req.body.assigned_to.trim() !== '' && !req.body.ticket_status) {
      payload.ticket_status = 'ASSIGNED';
    }

    const io = req.app && req.app.get ? req.app.get('io') : null;
    const response = await ticketsServices.updateTicketById(req.params.ticket_id, payload, io);
    res.json(response);
  } catch (error) {
    console.error("Error updating ticket:", error);
    throw new Error(error.message || "Failed to update ticket");
  }
});

const deleteTicket = expressAsync(async (req, res) => {
  try {
    const response = await ticketsServices.deleteTicket(req.params.ticket_id);
    res.json(response);
  } catch (error) {
    console.error("Error deleting ticket:", error);
    throw new Error(error.message || "Failed to delete ticket");
  }
});

export {
  createTicket,
  updateTicketStatuses,
  getTickets,
  getSingleTicketById,
  getTicketsByUserId,
  updateTicketById,
  deleteTicket
};