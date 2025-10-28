import conn from "./../config/db.js";
import { emitToUser, emitToConversation } from "../config/socket.js";
import notificationsServices from "./notificationsServices.js";

const pool = await conn();

const createMessage = async (messageData = {}, io = null) => {
  try {
    const { sender_user_id, recipient_user_id, message, attachments, tmpId } =
      messageData;

    if (!sender_user_id || !recipient_user_id || !message) {
      throw new Error("Sender, recipient, and message are required");
    }

    const conversation_id = [sender_user_id, recipient_user_id]
      .sort()
      .join("_");

    const query = `
      INSERT INTO messages (conversation_id, sender_user_id, recipient_user_id, message, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `;

    const [result] = await pool.query(query, [
      conversation_id,
      sender_user_id,
      recipient_user_id,
      message,
    ]);

    const [newMessage] = await pool.query(
      `SELECT m.*, 
       sender.first_name as sender_first_name, 
       sender.last_name as sender_last_name,
       sender.avatar as sender_avatar,
       recipient.first_name as recipient_first_name, 
       recipient.last_name as recipient_last_name,
       recipient.avatar as recipient_avatar
       FROM messages m
       LEFT JOIN users sender ON m.sender_user_id = sender.user_id
       LEFT JOIN users recipient ON m.recipient_user_id = recipient.user_id
       WHERE m.message_id = ?`,
      [result.insertId]
    );

    const messageData_result = newMessage[0];
    if (tmpId) messageData_result.tmpId = tmpId;

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      try {
        const values = attachments
          .filter((a) => a && a.url)
          .map((a) => [
            messageData_result.message_id,
            a.url,
            a.filename || null,
          ]);
        if (values.length) {
          await pool.query(
            "INSERT INTO message_attachments (message_id, url, filename) VALUES ?",
            [values]
          );
        }
        const [rows] = await pool.query(
          "SELECT attachment_id, url, filename FROM message_attachments WHERE message_id = ?",
          [messageData_result.message_id]
        );
        messageData_result.attachments = rows;
      } catch (e) {
        console.error("Error saving attachments:", e);
        messageData_result.attachments = attachments;
      }
    }

    if (io) {
      emitToUser(io, recipient_user_id, "new_message", messageData_result);
      emitToConversation(
        io,
        sender_user_id,
        recipient_user_id,
        "message_sent",
        messageData_result
      );
      emitToUser(io, sender_user_id, "conversation_updated", {
        otherUserId: recipient_user_id,
        lastMessage: message,
        lastMessageTime: messageData_result.created_at,
        conversationId: conversation_id,
      });
      emitToUser(io, recipient_user_id, "conversation_updated", {
        otherUserId: sender_user_id,
        lastMessage: message,
        lastMessageTime: messageData_result.created_at,
        conversationId: conversation_id,
      });
    }

    
    try {
      await notificationsServices.createNotification({
        user_id: recipient_user_id,
        type: 'MESSAGE',
        title: 'New message received',
        body: message.length > 80 ? message.slice(0, 77) + '...' : message,
        link: '/messages.html',
        meta: { conversation_id }
      }, (typeof io !== 'undefined') ? io : null);
    } catch (e) {
      console.warn('Failed to create message notification:', e?.message || e);
    }

    return {
      message: "Message created successfully",
      data: messageData_result,
    };
  } catch (error) {
    console.error("Error creating message:", error);
    throw new Error(error.message || "Failed to create message");
  }
};

const getMessagesByQuery = async (queryObj = {}) => {
  try {
    const {
      page = 1,
      limit = 20,
      sender_user_id,
      recipient_user_id,
      conversationId,
      search,
      sort = "created_at DESC",
    } = queryObj;

    const skip = (page - 1) * limit;

    let query = `
      SELECT m.*, 
       sender.first_name as sender_first_name, 
       sender.last_name as sender_last_name,
       sender.avatar as sender_avatar,
       recipient.first_name as recipient_first_name, 
       recipient.last_name as recipient_last_name,
       recipient.avatar as recipient_avatar
       FROM messages m
       LEFT JOIN users sender ON m.sender_user_id = sender.user_id
       LEFT JOIN users recipient ON m.recipient_user_id = recipient.user_id
       WHERE 1=1
    `;
    const params = [];

    if (sender_user_id) {
      query += " AND m.sender_user_id = ?";
      params.push(sender_user_id);
    }

    if (recipient_user_id) {
      query += " AND m.recipient_user_id = ?";
      params.push(recipient_user_id);
    }

    if (conversationId) {
      query += " AND m.conversation_id = ?";
      params.push(conversationId);
    }

    if (search && search.trim() !== "") {
      query += " AND m.message LIKE ?";
      params.push(`%${search.trim()}%`);
    }

    const allowedSorts = ["created_at DESC", "created_at ASC"];
    const orderBy = allowedSorts.includes(sort) ? sort : "created_at DESC";
    query += ` ORDER BY ${orderBy}`;

    query += " LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(skip));

    let countQuery = `
      SELECT COUNT(*) as total FROM messages m
      WHERE 1=1
    `;
    const countParams = [];

    if (sender_user_id) {
      countQuery += " AND m.sender_user_id = ?";
      countParams.push(sender_user_id);
    }

    if (recipient_user_id) {
      countQuery += " AND m.recipient_user_id = ?";
      countParams.push(recipient_user_id);
    }

    if (conversationId) {
      countQuery += " AND m.conversation_id = ?";
      countParams.push(conversationId);
    }

    if (search && search.trim() !== "") {
      countQuery += " AND m.message LIKE ?";
      countParams.push(`%${search.trim()}%`);
    }

    const [messages] = await pool.query(query, params);

    try {
      if (messages.length > 0) {
        const ids = messages.map((m) => m.message_id);
        const [attRows] = await pool.query(
          `SELECT attachment_id, message_id, url, filename FROM message_attachments WHERE message_id IN (${ids
            .map(() => "?")
            .join(",")})`,
          ids
        );
        const map = new Map();
        attRows.forEach((a) => {
          if (!map.has(a.message_id)) map.set(a.message_id, []);
          map
            .get(a.message_id)
            .push({ id: a.id, url: a.url, filename: a.filename });
        });
        messages.forEach((m) => {
          m.attachments = map.get(m.message_id) || [];
        });
      }
    } catch (e) {
      messages.forEach((m) => {
        m.attachments = [];
      });
    }
    const [countResult] = await pool.query(countQuery, countParams);
    const total = countResult[0].total;

    return {
      messages,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalMessages: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  } catch (error) {
    console.error("Error getting messages:", error);
    throw new Error(error.message || "Failed to get messages");
  }
};

const getMessageById = async (message_id) => {
  try {
    if (!message_id) {
      throw new Error("Message ID is required");
    }

    const query = `
      SELECT m.*, 
       sender.first_name as sender_first_name, 
       sender.last_name as sender_last_name,
       sender.avatar as sender_avatar,
       recipient.first_name as recipient_first_name, 
       recipient.last_name as recipient_last_name,
       recipient.avatar as recipient_avatar
       FROM messages m
       LEFT JOIN users sender ON m.sender_user_id = sender.user_id
       LEFT JOIN users recipient ON m.recipient_user_id = recipient.user_id
       WHERE m.message_id = ?
    `;

    const [messages] = await pool.query(query, [message_id]);

    if (messages.length === 0) {
      throw new Error("Message not found");
    }

    const msg = messages[0];

    try {
      const [attRows] = await pool.query(
        "SELECT attachment_id, url, filename FROM message_attachments WHERE message_id = ?",
        [message_id]
      );
      msg.attachments = attRows;
    } catch {
      msg.attachments = [];
    }
    return msg;
  } catch (error) {
    console.error("Error getting message:", error);
    throw new Error(error.message || "Failed to get message");
  }
};

const updateMessageById = async (message_id, updateData = {}, io = null) => {
  try {
    if (!message_id) {
      throw new Error("Message ID is required");
    }

    const originalMessage = await getMessageById(message_id);

    const { message } = updateData;

    if (!message || message.trim() === "") {
      throw new Error("Message content is required");
    }

    const query = `
      UPDATE messages 
      SET message = ?, created_at = created_at
      WHERE message_id = ?
    `;

    const [result] = await pool.query(query, [message.trim(), message_id]);

    if (result.affectedRows === 0) {
      throw new Error("Message could not be updated");
    }

    const updatedMessage = await getMessageById(message_id);

    if (io) {
      emitToUser(
        io,
        originalMessage.sender_user_id,
        "message_updated",
        updatedMessage
      );
      emitToUser(
        io,
        originalMessage.recipient_user_id,
        "message_updated",
        updatedMessage
      );
      emitToConversation(
        io,
        originalMessage.sender_user_id,
        originalMessage.recipient_user_id,
        "message_edited",
        updatedMessage
      );
    }

    return {
      message: "Message updated successfully",
      data: updatedMessage,
    };
  } catch (error) {
    console.error("Error updating message:", error);
    throw new Error(error.message || "Failed to update message");
  }
};

const deleteMessageById = async (message_id, io = null) => {
  try {
    if (!message_id) {
      throw new Error("Message ID is required");
    }

    const messageToDelete = await getMessageById(message_id);

    const query = `DELETE FROM messages WHERE message_id = ?`;
    const [result] = await pool.query(query, [message_id]);

    if (result.affectedRows === 0) {
      throw new Error("Message could not be deleted");
    }

    const deletedMessageInfo = {
      message_id: messageToDelete.message_id,
      conversation_id: messageToDelete.conversation_id,
      sender_first_name: messageToDelete.sender_first_name,
      sender_last_name: messageToDelete.sender_last_name,
      recipient_first_name: messageToDelete.recipient_first_name,
      recipient_last_name: messageToDelete.recipient_last_name,
      message: messageToDelete.message,
      created_at: messageToDelete.created_at,
    };

    if (io) {
      emitToUser(io, messageToDelete.sender_user_id, "message_deleted", {
        message_id,
        conversation_id: messageToDelete.conversation_id,
      });
      emitToUser(io, messageToDelete.recipient_user_id, "message_deleted", {
        message_id,
        conversation_id: messageToDelete.conversation_id,
      });
      emitToConversation(
        io,
        messageToDelete.sender_user_id,
        messageToDelete.recipient_user_id,
        "message_removed",
        { message_id, conversation_id: messageToDelete.conversation_id }
      );
    }

    return {
      message: `Message with ID ${message_id} has been successfully deleted`,
      deletedMessage: deletedMessageInfo,
    };
  } catch (error) {
    console.error("Error deleting message:", error);
    throw new Error(error.message || "Failed to delete message");
  }
};

const getConversations = async (user_id) => {
  try {
    if (!user_id) {
      throw new Error("User ID is required");
    }

    const query = `
      SELECT DISTINCT
        CASE 
          WHEN m.sender_user_id = ? THEN m.recipient_user_id
          ELSE m.sender_user_id
        END as other_user_id,
        CASE 
          WHEN m.sender_user_id = ? THEN CONCAT(recipient.first_name, ' ', recipient.last_name)
          ELSE CONCAT(sender.first_name, ' ', sender.last_name)
        END as other_user_name,
        CASE 
          WHEN m.sender_user_id = ? THEN recipient.avatar
          ELSE sender.avatar
        END as other_user_avatar,
        MAX(m.created_at) as last_message_time,
        (SELECT message FROM messages m2 
         WHERE (m2.sender_user_id = ? AND m2.recipient_user_id = other_user_id) 
            OR (m2.sender_user_id = other_user_id AND m2.recipient_user_id = ?)
         ORDER BY m2.created_at DESC LIMIT 1) as last_message
      FROM messages m
      LEFT JOIN users sender ON m.sender_user_id = sender.user_id
      LEFT JOIN users recipient ON m.recipient_user_id = recipient.user_id
      WHERE m.sender_user_id = ? OR m.recipient_user_id = ?
      GROUP BY other_user_id, other_user_name, other_user_avatar
      ORDER BY last_message_time DESC
    `;

    const [conversations] = await pool.query(query, [
      user_id,
      user_id,
      user_id,
      user_id,
      user_id,
      user_id,
      user_id,
    ]);

    return conversations;
  } catch (error) {
    console.error("Error getting conversations:", error);
    throw new Error(error.message || "Failed to get conversations");
  }
};

export default {
  createMessage,
  getMessagesByQuery,
  getMessageById,
  updateMessageById,
  deleteMessageById,
  getConversations,
};
