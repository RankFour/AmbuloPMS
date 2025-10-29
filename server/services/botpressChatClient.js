import * as chat from '@botpress/chat';

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

async function getClientForUser(userId) {
  if (!webhookId) throw new Error('Botpress Chat API not configured (BP_CHAT_WEBHOOK_ID)');
  if (!userId) throw new Error('Missing userId');

  if (!clientCache.has(userId)) {
    const connectOpts = { webhookId };
    
    if (encryptionKey) Object.assign(connectOpts, { userId: String(userId), encryptionKey });
    try {
      const promise = chat.Client.connect(connectOpts);
      clientCache.set(userId, promise);
    } catch (err) {
      console.error('[botpressChat] Failed to connect to Chat API', {
        webhookIdMasked: `${webhookId.slice(0, 6)}...${webhookId.slice(-4)}`,
        encryptionKeyPresent: Boolean(encryptionKey),
        err: err?.message || err,
      });
      throw err;
    }
  }
  return clientCache.get(userId);
}

export async function ensureConversation(userId) {
  const client = await getClientForUser(userId);
  let convId = convCache.get(userId);
  if (!convId) {
    try {
      const { conversation } = await client.createConversation({});
      convId = conversation.id;
      convCache.set(userId, convId);
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
  const client = await getClientForUser(userId);
  const conv = conversationId || convCache.get(userId);
  if (!conv) throw new Error('No conversation. Call open first.');
  await client.createMessage({
    conversationId: conv,
    payload: { type: 'text', text: String(text) }
  });
  return { ok: true };
}

export async function listMessages(userId, conversationId, limit = 25) {
  const client = await getClientForUser(userId);
  const conv = conversationId || convCache.get(userId);
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
};
