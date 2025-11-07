import expressAsync from "express-async-handler";
import contactUsServices from "../services/contactUsServices.js";
import mailer from "../utils/mailer.js";
import companyDetailsServices from "../services/companyDetailsServices.js";
import { buildBrandedEmail } from "../utils/emailTemplates.js";

const createContactUsEntry = expressAsync(async (req, res) => {
  try {
    const payload = { ...req.body };
    try { console.info('[ContactUs] createContactUsEntry received', { keys: Object.keys(payload || {}) }); } catch(_) {}

    if (!payload || Object.keys(payload).length === 0) {
      res
        .status(400)
        .json({
          message:
            "Request body is empty. Make sure you send form fields (application/json or multipart/form-data with a parser).",
        });
      return;
    }
  
  const io = req.app && req.app.get ? req.app.get('io') : null;
    const response = await contactUsServices.createContactUsEntry(payload, io);
    try { console.info('[ContactUs] created submission', { id: response && response.id }); } catch(_) {}
    res.json(response);
  } catch (error) {
    console.error("Error creating contact us entry:", error);
    throw new Error(error.message || "Failed to create contact us entry");
  }
});

const getAllContactUsEntries = expressAsync(async (req, res) => {
  try {
    const response = await contactUsServices.getAllContactUsEntries(req.query);
    res.json(response);
  } catch (error) {
    console.error("Error fetching contact us entries:", error);
    throw new Error(error.message || "Failed to fetch contact us entries");
  }
});

const getContactUsEntryById = expressAsync(async (req, res) => {
  try {
    const response = await contactUsServices.getContactUsEntryById(
      req.params.entry_id
    );
    res.json(response);
  } catch (error) {
    console.error("Error getting contact us entry:", error);
    throw new Error(error.message || "Failed to get contact us entry");
  }
});

const editContactUsEntry = expressAsync(async (req, res) => {
  try {
    const payload = { ...req.body };
    const response = await contactUsServices.editContactUsEntry(
      req.params.entry_id,
      payload
    );
    res.json(response);
  } catch (error) {
    console.error("Error editing contact us entry:", error);
    throw new Error(error.message || "Failed to edit contact us entry");
  }
});

const deleteContactUsEntry = expressAsync(async (req, res) => {
  try {
    const response = await contactUsServices.deleteContactUsEntry(
      req.params.entry_id
    );
    res.json(response);
  } catch (error) {
    console.error("Error deleting contact us entry:", error);
    throw new Error(error.message || "Failed to delete contact us entry");
  }
});

const sendContactReply = expressAsync(async (req, res) => {
  try {
    const { to, subject, message, html, cc, bcc, replyTo } = req.body || {};
    if (!to || !subject || !(message || html)) {
      res
        .status(400)
        .json({
          message: "Missing required fields: to, subject, and message or html",
        });
      return;
    }

    let company = null;
    try {
      const rows = await companyDetailsServices.getCompanyDetails();
      company = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    } catch (e) {
      /* non-fatal */
    }

    const bodyHtml =
      html ||
      (message
        ? message
          .split("\n")
          .map((p) => `<p style="margin:0 0 12px">${escapeHtml(p)}</p>`)
          .join("")
        : "");
    const {
      html: wrappedHtml,
      text: wrappedText,
      attachments,
    } = buildBrandedEmail({ bodyHtml, bodyText: message || "" }, company || {});

    const mailRes = await mailer.sendMail({
      to,
      subject,
      text: wrappedText,
      html: wrappedHtml,
      cc,
      bcc,
      replyTo,
      attachments,
    });

    const { entry_id } = req.params;
    if (entry_id) {
      try {
        await contactUsServices.editContactUsEntry(entry_id, {
          status: "responded",
          replied_at: new Date(),
        });
      } catch (e) {
        /* non-fatal */
      }
    }

    res.json({ ok: true, mail: mailRes });
  } catch (error) {
    console.error("Error sending contact reply:", error);
    res.status(500).json({ message: error.message || "Failed to send email" });
  }
});

const previewContactReply = expressAsync(async (req, res) => {
  try {
    const fromBody = req.method !== "GET";
    const message = fromBody
      ? req.body?.message || ""
      : req.query?.message || "";
    const html = fromBody ? req.body?.html || "" : req.query?.html || "";

    let company = null;
    try {
      const rows = await companyDetailsServices.getCompanyDetails();
      company = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    } catch (e) {
      /* non-fatal */
    }

    const bodyHtml =
      html ||
      (message
        ? message
          .split("\n")
          .map((p) => `<p style="margin:0 0 12px">${escapeHtml(p)}</p>`)
          .join("")
        : '<p style="margin:0">(No content)</p>');
    const { html: wrappedHtml } = buildBrandedEmail(
      { bodyHtml, bodyText: message || "" },
      company || {}
    );

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(wrappedHtml);
  } catch (error) {
    console.error("Error generating preview:", error);
    res
      .status(500)
      .json({ message: error.message || "Failed to render preview" });
  }
});

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export {
  createContactUsEntry,
  getAllContactUsEntries,
  getContactUsEntryById,
  editContactUsEntry,
  deleteContactUsEntry,
  sendContactReply,
  previewContactReply,
};
