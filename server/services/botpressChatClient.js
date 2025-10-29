import * as chat from '@botpress/chat';
import conn from "../config/db.js";


const pool = await conn();

const webhookId = process.env.BP_CHAT_WEBHOOK_ID || process.env.BOTPRESS_CHAT_WEBHOOK_ID || '';
const encryptionKey = process.env.BP_CHAT_ENCRYPTION_KEY || process.env.BOTPRESS_CHAT_ENCRYPTION_KEY || '';

if (!webhookId) {
  
  console.warn('[botpressChat] Missing BP_CHAT_WEBHOOK_ID. Chat API integration will be disabled until configured.');
} else {
  const masked = `${webhookId.slice(0, 6)}...${webhookId.slice(-4)}`;
  console.info('[botpressChat] Using Chat API', {
    webhookId: masked,
    encryptionKeyPresent: Boolean(encryptionKey),
  });
}


const clientCache = new Map(); 
const convCache = new Map();   
const localToBotpressUser = new Map();
const botpressToLocalUser = new Map();

async function getClientForUser(userId) {
  if (!webhookId) throw new Error('Botpress Chat API not configured (BP_CHAT_WEBHOOK_ID)');
  if (!userId) throw new Error('Missing userId');

  const cacheKey = String(userId);
  if (!clientCache.has(cacheKey)) {
    const connectOpts = { webhookId, userId: cacheKey };
    if (encryptionKey) connectOpts.encryptionKey = encryptionKey;
    try {
      const promise = chat.Client.connect(connectOpts).then(async (client) => {
        const bpUserId = client?.user?.id ? String(client.user.id) : null;
        if (bpUserId) {
          botpressToLocalUser.set(bpUserId, cacheKey);
          localToBotpressUser.set(cacheKey, bpUserId);
          try {
            
            await pool.query(`CREATE TABLE IF NOT EXISTS botpress_user_map (botpress_user_id VARCHAR(255) PRIMARY KEY, local_user_id VARCHAR(255) NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
            
            await pool.query(
              `INSERT INTO botpress_user_map (botpress_user_id, local_user_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE local_user_id = VALUES(local_user_id)`,
              [bpUserId, cacheKey]
            );
          } catch (dbErr) {
            console.warn('[botpressChat] failed to persist mapping to DB', dbErr?.message || dbErr);
          }
        }
        return client;
      });
      clientCache.set(cacheKey, promise);
    } catch (err) {
      console.error('[botpressChat] Failed to connect to Chat API', {
        webhookIdMasked: `${webhookId.slice(0, 6)}...${webhookId.slice(-4)}`,
        encryptionKeyPresent: Boolean(encryptionKey),
        err: err?.message || err,
      });
      throw err;
    }
  }
  return clientCache.get(cacheKey);
}

export async function ensureConversation(userId) {
  const cacheKey = String(userId);
  const client = await getClientForUser(cacheKey);
  const bpUserId = client?.user?.id ? String(client.user.id) : null;
  if (bpUserId) {
    botpressToLocalUser.set(bpUserId, cacheKey);
    localToBotpressUser.set(cacheKey, bpUserId);
  }
  let convId = convCache.get(cacheKey);
  if (!convId) {
    try {
      const { conversation } = await client.createConversation({});
      convId = conversation.id;
      convCache.set(cacheKey, convId);
    } catch (err) {
      console.error('[botpressChat] createConversation failed', {
        webhookIdMasked: `${webhookId.slice(0, 6)}...${webhookId.slice(-4)}`,
        encryptionKeyPresent: Boolean(encryptionKey),
        err: err?.message || err,
      });
      throw err;
    }
  }
  return { client, conversationId: convId };
}

export async function sendTextMessage(userId, conversationId, text) {
  if (!text || !String(text).trim()) throw new Error('Message text is required');
  const cacheKey = String(userId);
  const client = await getClientForUser(cacheKey);
  const conv = conversationId || convCache.get(cacheKey);
  if (!conv) throw new Error('No conversation. Call open first.');
  await client.createMessage({
    conversationId: conv,
    payload: { type: 'text', text: String(text) },
    metadata: {
      sender: 'user',
      userKey: cacheKey,
      direction: 'outgoing'
    }
  });
  return { ok: true };
}

export async function listMessages(userId, conversationId, limit = 25) {
  const cacheKey = String(userId);
  const client = await getClientForUser(cacheKey);
  const conv = conversationId || convCache.get(cacheKey);
  if (!conv) throw new Error('No conversation.');
  const res = await client.listMessages({ conversationId: conv, limit });
  
  const messages = Array.isArray(res.messages)
    ? res.messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    : [];
  return { conversationId: conv, messages };
}

export default {
  ensureConversation,
  sendTextMessage,
  listMessages,
  getLocalUserIdFromBotpress,
  getBotpressUserIdFromLocal,
};

export function getLocalUserIdFromBotpress(botpressUserId) {
  if (!botpressUserId) return null;
  return botpressToLocalUser.get(String(botpressUserId)) || null;
}

export function getBotpressUserIdFromLocal(localUserId) {
  if (!localUserId) return null;
  return localToBotpressUser.get(String(localUserId)) || null;
}
