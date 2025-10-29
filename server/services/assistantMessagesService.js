import conn from "../config/db.js";
import { v4 as uuidv4 } from "uuid";

const pool = await conn();

export async function getOrCreateConversation(userId) {
  const uid = String(userId);
  const [rows] = await pool.query(
    "SELECT conversation_id FROM assistant_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
    [uid]
  );
  if (rows && rows.length) return rows[0].conversation_id;
  const conversation_id = `conv_${uuidv4().replace(/-/g, '').slice(0, 22)}`;
  await pool.query(
    "INSERT INTO assistant_conversations (conversation_id, user_id) VALUES (?, ?)",
    [conversation_id, uid]
  );
  return conversation_id;
}

export async function addMessage(conversation_id, { direction, text, metadata }) {
  const meta = metadata ? JSON.stringify(metadata) : null;
  await pool.query(
    "INSERT INTO assistant_messages (conversation_id, direction, text, metadata) VALUES (?, ?, ?, ?)",
    [conversation_id, direction, text, meta]
  );
  await pool.query(
    "UPDATE assistant_conversations SET updated_at = NOW() WHERE conversation_id = ?",
    [conversation_id]
  );
}

export async function listMessages(conversation_id, limit = 30) {
  const lim = Math.max(1, Number(limit) || 30);
  const [rows] = await pool.query(
    "SELECT id, direction, text, metadata, created_at FROM assistant_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?",
    [conversation_id, lim]
  );
  return rows.slice().reverse().map(r => ({
    id: r.id,
    direction: r.direction,
    payload: { type: 'text', text: r.text },
    metadata: (()=>{ try { return r.metadata ? JSON.parse(r.metadata) : {}; } catch { return {}; } })(),
    createdAt: r.created_at,
  }));
}

export async function hasAnyMessage(conversation_id) {
  const [rows] = await pool.query(
    "SELECT id FROM assistant_messages WHERE conversation_id = ? LIMIT 1",
    [conversation_id]
  );
  return Boolean(rows && rows.length);
}

export async function clearConversation(conversation_id) {
  await pool.query(
    "DELETE FROM assistant_messages WHERE conversation_id = ?",
    [conversation_id]
  );
  await pool.query(
    "UPDATE assistant_conversations SET updated_at = NOW() WHERE conversation_id = ?",
    [conversation_id]
  );
}

export default { getOrCreateConversation, addMessage, listMessages, hasAnyMessage, clearConversation };
