import usersServices from "./usersServices.js";
import paymentsServices from "./paymentsServices.js";
import leaseServices from "./leaseServices.js";
import faqsServices from "./faqsServices.js";
import ticketsServices from "./ticketsServices.js";
import chargesServices from "./chargesServices.js";
import propertiesServices from "./propertiesServices.js";
import companyDetailsServices from "./companyDetailsServices.js";
import gemini from "./geminiService.js";
import assistantMessages from "./assistantMessagesService.js";

// Persistence powered by DB (assistant_conversations, assistant_messages)
async function ensureConvForUser(userId) {
  return assistantMessages.getOrCreateConversation(String(userId));
}

async function pushMessage(conversationId, msg) {
  const text = msg?.payload?.text || "";
  const direction = msg?.direction || "incoming";
  const metadata = msg?.metadata || {};
  await assistantMessages.addMessage(conversationId, { direction, text, metadata });
}

async function tryGeminiReply(promptText, context = {}, role = null) {
  const backendPref = (process.env.BP_ASSISTANT_BACKEND || "").toLowerCase();
  // Default to Gemini if configured unless explicitly forced to 'local'
  if (backendPref === 'local') return null;
  if (!gemini.isConfigured()) return null;
  // First try intent extraction and handle if recognized
  try {
    const parsed = await gemini.extractIntent({ text: promptText, role });
    if (parsed && parsed.intent) {
      const handled = await handleParsedIntent(context.userId || null, role, parsed.intent, parsed.params || {});
      if (handled) return handled;
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn("[localAssistant] Gemini intent extraction failed:", e?.message || e);
  }
  // Fall back to pure generation
  try {
    const sysRole = String(role || 'TENANT').toUpperCase();
  const system = `You are Ambulo Assistant, a helpful property management assistant. Be concise and actionable. If data is unavailable, say what is needed. The current user role is ${sysRole}. Adjust phrasing: for ADMIN, use operational phrasing; for TENANT, be supportive.

Capabilities you can use:
- Show profile, lease, payments, charges, FAQs, tickets
- For admins: search tenants, list charges/payments/tickets, counts (overdue/due soon/outstanding), confirm/reject payments, simple create charge
- Property discovery: list available properties and count them
- Utility commands: 'help'/'commands' shows capabilities; 'clear chat' resets the conversation
`;
    const text = await gemini.generateText({ text: promptText, system, context: { ...context, role: sysRole } });
    return (text || "").trim() || null;
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn("[localAssistant] Gemini generate failed:", e?.message || e);
    return null;
  }
}

async function handleParsedIntent(userId, role, intent, params = {}) {
  const as = String(intent || "").toLowerCase();
  const isAdmin = isAdminLike(role);
  try {
    switch (as) {
      case "help":
      case "show_help": {
        if (isAdmin) {
          return (
            "I can help with quick admin lookups:\n" +
            "• 'show my profile'\n" +
            "• 'show payments [paid|pending|overdue|all]'\n" +
            "Tip: For tenant- or property-level actions, use the admin pages (Payments, Leases, Tenants)."
          );
        }
        return (
          "I can help with:\n" +
          "• 'show my profile'\n" +
          "• 'show my lease'\n" +
          "• 'show my payments [paid|pending|overdue|all]'"
        );
      }
      case "show_profile": {
        const user = await usersServices.getSingleUserById(String(userId));
        if (!user) return "I couldn't find your profile.";
        const { password_hash, ...safe } = user;
        const summary = [
          safe.full_name ? `Name: ${safe.full_name}` : null,
          safe.email ? `Email: ${safe.email}` : null,
          safe.phone_number ? `Phone: ${safe.phone_number}` : null,
        ].filter(Boolean).join("\n");
        return summary || "I found your profile, but there are no public fields to display.";
      }
      case "show_lease": {
        const leases = await leaseServices.getLeaseByUserId(String(userId));
        const sorted = (leases || []).slice().sort((a, b) => new Date(b.lease_start_date || 0) - new Date(a.lease_start_date || 0));
        const current = sorted.find(l => String(l.lease_status).toUpperCase() === 'ACTIVE')
          || sorted.find(l => String(l.lease_status).toUpperCase() === 'PENDING')
          || sorted[0]
          || null;
        if (!current) return "I couldn't find a lease for you.";
        const lines = [];
        if (current.property_name) lines.push(`Property: ${current.property_name}`);
        if (current.property_address) lines.push(`Address: ${current.property_address}`);
        if (current.monthly_rent) lines.push(`Monthly Rent: ${current.monthly_rent}`);
        if (current.payment_frequency) lines.push(`Payment Frequency: ${current.payment_frequency}`);
        if (current.lease_start_date) lines.push(`Start: ${new Date(current.lease_start_date).toLocaleDateString()}`);
        if (current.lease_end_date) lines.push(`End: ${new Date(current.lease_end_date).toLocaleDateString()}`);
        if (current.lease_status) lines.push(`Status: ${current.lease_status}`);
        return lines.join("\n") || "I found a lease, but couldn't format the details.";
      }
      case "show_payments": {
        const statusParam = String(params?.status || '').toUpperCase();
        const status = ["PAID", "PENDING", "OVERDUE", "ALL"].includes(statusParam) ? statusParam : "ALL";
        if (isAdmin) {
          const data = await paymentsServices.getAllPayments({ status: status === 'PAID' ? 'Confirmed' : (status === 'ALL' ? undefined : status), page: 1, limit: 20 });
          const rows = Array.isArray(data?.rows) ? data.rows : [];
          if (!rows.length) return `No ${status === 'ALL' ? '' : status.toLowerCase() + ' '}payments found.`;
          const top5 = rows.slice(0, 5);
          const lines = top5.map(p => `• ${new Date(p.created_at || Date.now()).toLocaleDateString()} - ${p.amount_paid} (${p.status}) — ${p.tenant_name || ''}`);
          const suffix = rows.length > 5 ? `\n…and ${rows.length - 5} more.` : '';
          return `Payments:\n${lines.join('\n')}${suffix}`;
        }
        const data = await paymentsServices.getPaymentsByUserId(String(userId), { page: 1, limit: 20 });
        let rows = Array.isArray(data?.rows) ? data.rows : [];
        if (status !== "ALL") rows = rows.filter(r => String(r.status).toUpperCase() === status);
        if (rows.length === 0) return `No ${status === 'ALL' ? '' : status.toLowerCase() + ' '}payments found.`;
        const top5 = rows.slice(0, 5);
        const lines = top5.map(p => `• ${new Date(p.payment_date || p.created_at || Date.now()).toLocaleDateString()} - ${p.amount} (${p.status})`);
        const suffix = rows.length > 5 ? `\n…and ${rows.length - 5} more.` : '';
        return `Here are your ${status === 'ALL' ? '' : status.toLowerCase() + ' '}payments:\n${lines.join('\n')}${suffix}`;
      }
      case "list_faqs": {
        const list = await faqsServices.getAllFaqs();
        const actives = (list || []).filter(f => f.is_active !== 0);
        const top = actives.slice(0, 5);
        if (!top.length) return "No FAQs available right now.";
        const lines = top.map(f => `• ${f.question}`);
        return `Here are some common questions:\n${lines.join('\n')}`;
      }
      case "list_tickets": {
        const raw = params?.status ? String(params.status) : '';
        let status = raw ? raw.replace(/[_\s-]+/g, '_').toUpperCase() : 'ALL';
        if (status === 'ALL') status = undefined;
        if (isAdmin) {
          const res = await ticketsServices.getTickets({ status, page: 1, limit: 5 });
          const rows = Array.isArray(res?.tickets) ? res.tickets : [];
          if (!rows.length) return `No tickets${status ? ' with status ' + status : ''}.`;
          const lines = rows.slice(0, 5).map(t => `• ${t.ticket_title || 'Ticket'} — ${t.ticket_status} (${t.property_name || 'N/A'})`);
          return `Tickets${status ? ' [' + status + ']' : ''}:\n${lines.join('\n')}`;
        }
        const data = await ticketsServices.getTicketsByUserId(String(userId), { page: 1, limit: 5 });
        const rows = Array.isArray(data?.tickets) ? data.tickets : [];
        if (!rows.length) return "You have no recent tickets.";
        const lines = rows.map(t => `• ${t.ticket_title || 'Ticket'} - ${t.ticket_status} (${new Date(t.created_at || Date.now()).toLocaleDateString()})`);
        return `Your recent tickets:\n${lines.join('\n')}`;
      }
      case "create_ticket": {
        const title = (params?.title || '').toString().trim();
        const description = (params?.description || '').toString().trim();
        if (!title || !description) return "To create a ticket, provide title and description.";
        await ticketsServices.createTicket({ ticket_title: title.slice(0,120), description: description.slice(0,1000), priority: 'LOW', request_type: 'Maintenance', user_id: String(userId) }, String(userId));
        return `Ticket created: ${title}`;
      }
      case "search_tenants": {
        if (!isAdmin) return "This action requires an admin account.";
        const query = (params?.query || '').toString().trim();
        if (!query) return "Provide a search query.";
        const res = await usersServices.getUsers({ search: query, limit: 5, page: 1 });
        const users = Array.isArray(res?.users) ? res.users : [];
        if (!users.length) return `No tenants matched "${query}".`;
        const lines = users.map(u => `• ${u.first_name || ''} ${u.last_name || ''} — ${u.email || ''}`.trim());
        return `Top matches for "${query}":\n${lines.join('\n')}`;
      }
      case "list_overdue_charges": {
        if (!isAdmin) return "This action requires an admin account.";
        const res = await chargesServices.getAllCharges({ status: 'OVERDUE', limit: 5, page: 1 });
        const rows = Array.isArray(res?.data) ? res.data : [];
        if (!rows.length) return "No overdue charges right now.";
        const lines = rows.slice(0, 5).map(c => `• ${c.tenant_name || 'Tenant'} — ${c.description || c.charge_type || 'Charge'} ${c.amount} (due ${new Date(c.due_date || c.charge_date || Date.now()).toLocaleDateString()})`);
        return `Overdue charges:\n${lines.join('\n')}`;
      }
      case "list_due_soon_charges": {
        if (!isAdmin) return "This action requires an admin account.";
        const res = await chargesServices.getAllCharges({ status: 'DUE-SOON', limit: 5, page: 1 });
        const rows = Array.isArray(res?.data) ? res.data : [];
        if (!rows.length) return "No charges due soon (next 3 days).";
        const lines = rows.slice(0, 5).map(c => `• ${c.tenant_name || 'Tenant'} — ${c.description || c.charge_type || 'Charge'} ${c.amount} (due ${new Date(c.due_date || c.charge_date || Date.now()).toLocaleDateString()})`);
        return `Charges due soon:\n${lines.join('\n')}`;
      }
      case "list_pending_payments": {
        if (!isAdmin) return "This action requires an admin account.";
        const res = await paymentsServices.getAllPayments({ status: 'Pending', limit: 5, page: 1 });
        const rows = Array.isArray(res?.rows) ? res.rows : [];
        if (!rows.length) return "No pending payments.";
        const lines = rows.slice(0, 5).map(p => `• ${p.payment_id} — ${p.tenant_name || ''} ${p.amount_paid} (${p.payment_method || 'method?'})`);
        return `Pending payments:\n${lines.join('\n')}`;
      }
      case "confirm_payment": {
        if (!isAdmin) return "This action requires an admin account.";
        const id = (params?.payment_id || '').toString().trim();
        if (!id) return "Provide a payment_id to confirm.";
        await paymentsServices.updatePaymentById(id, { status: 'confirm', user_id: String(userId) }, String(userId));
        return `Payment ${id} confirmed.`;
      }
      case "reject_payment": {
        if (!isAdmin) return "This action requires an admin account.";
        const id = (params?.payment_id || '').toString().trim();
        if (!id) return "Provide a payment_id to reject.";
        await paymentsServices.updatePaymentById(id, { status: 'reject', user_id: String(userId) }, String(userId));
        return `Payment ${id} rejected.`;
      }
      case "create_charge": {
        if (!isAdmin) return "This action requires an admin account.";
        const leaseId = (params?.lease_id || '').toString().trim();
        const amount = Number(params?.amount);
        const description = (params?.description || '').toString().trim();
        if (!leaseId || !amount || !description) return "Provide lease_id, amount, and description.";
        const now = new Date();
        const due = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        await chargesServices.createCharge({
          lease_id: leaseId,
          charge_type: 'Manual',
          description,
          amount,
          charge_date: now,
          due_date: due,
          is_recurring: 0,
          status: 'Unpaid',
        });
        return `Charge created for lease ${leaseId}: ₱${amount} — ${description}`;
      }
      case "list_properties": {
        const res = await propertiesServices.getProperties({ property_status: 'Available', limit: 5, page: 1 });
        const props = Array.isArray(res?.properties) ? res.properties : [];
        if (!props.length) return "No available properties found right now.";
        const lines = props.map(p => `• ${p.property_name}${p.city ? ` — ${p.city}` : ''}${p.base_rent ? ` (₱${p.base_rent})` : ''}`);
        return `Available properties:\n${lines.join('\n')}`;
      }
      case "company_info": {
        const rows = await companyDetailsServices.getCompanyDetails();
        const info = Array.isArray(rows) && rows.length ? rows[0] : null;
        if (!info) return "Company details are not configured yet.";
        const lines = [];
        if (info.company_name) lines.push(`Name: ${info.company_name}`);
        if (info.email) lines.push(`Email: ${info.email}`);
        if (info.phone_number) lines.push(`Phone: ${info.phone_number}`);
        const addr = [info.house_no, info.street_address, info.city, info.province, info.zip_code, info.country].filter(Boolean).join(', ');
        if (addr) lines.push(`Address: ${addr}`);
        return lines.join('\n') || "Company details are not available.";
      }
      default:
        return null;
    }
  } catch (e) {
    return `Sorry, I couldn't process that (${e?.message || e}).`;
  }
}

function isAdminLike(role) {
  return ["ADMIN", "MANAGER"].includes(String(role || "").toUpperCase());
}

function commandsText(role) {
  const isAdmin = isAdminLike(role);
  const base = [
    "show my profile",
    "show my lease",
    "show my payments [paid|pending|overdue|all]",
    "show my charges",
    "faqs",
    "create ticket - <Title>: <Description>",
    "list properties (available)",
    "how many properties are available",
  ];
  const adminExtra = [
    "search tenants <name>",
    "overdue charges",
    "how many overdue charges",
    "how many charges are due soon",
    "how many outstanding charges",
    "pending payments",
    "confirm payment <id>",
    "reject payment <id>",
    "list tickets status: in_progress",
  ];
  const utils = [
    "commands",
    "help",
    "clear chat",
  ];
  const all = isAdmin ? [...base, ...adminExtra, ...utils] : [...base, ...utils];
  return `Commands I understand:\n- ${all.join('\n- ')}`;
}

async function routeLocalIntent(userId, text, role) {
  const lc = String(text || "").toLowerCase();

  // Simple intents with basic synonyms
  const wantsHelp = /^(help|hi|hello|menu|options|\/help|commands|\/commands)$/i.test(text || "") || /what can you do|list (your )?commands/i.test(lc);
  const wantsClear = /^(\/)?clear( chat)?$/i.test((text||'').trim()) || /reset (the )?chat|start over|wipe chat/i.test(lc);
  const wantsProfile = /profile|account|my info|my information/.test(lc);
  const wantsLease = /lease|rent\s*agreement|contract/.test(lc);
  const wantsPayments = /payment|invoice|bill|paid|pending|overdue/.test(lc);
  const wantsFaqs = /\bfaqs?\b|help articles|common questions/.test(lc);
  const wantsTickets = /\btickets?\b|maintenance|repair request/.test(lc);
  const wantsCreateTicket = /create .*ticket|open .*ticket/.test(lc);
  const wantsCharges = /\bcharges?\b|balance|due(\s|$)|overdue/.test(lc);
  const wantsCompany = /company info|contact|support|phone|email|address/.test(lc);
  const wantsAvailableProps = /(available properties|vacant|list properties|show available properties|list available properties)/i.test(lc);
  const wantsAbout = /\babout\s+us\b|our\s+story|mission|vision/.test(lc);
  const wantsInvoice = /^invoice\s+([a-z0-9-]+)/i.exec(text || "");
  const adminReportFinancial = /report\s+financial/i.test(lc);
  const adminReportTenants = /report\s+tenants?/i.test(lc);
  const adminReportProperties = /report\s+(properties|leases?)/i.test(lc);
  const adminReportMaintenance = /report\s+maintenance|report\s+tickets/i.test(lc);
  // Admin intents
  const adminSearchTenants = /^(search|find)\s+tenants?\s+(.+)/i.exec(text || "");
  const adminOverdueCharges = /overdue\s+charges?/i.test(lc);
  const adminDueSoonCharges = /due\s+soon\s+charges?/i.test(lc);
  const adminPendingPayments = /pending\s+payments?/i.test(lc);
  const adminCountOverdueCharges = /(how\s+many|count)\s+(overdue)\s+charges?/i.test(lc);
  const adminCountDueSoonCharges = /(how\s+many|count)\s+(due\s*soon)\s+charges?/i.test(lc);
  const adminCountOutstandingCharges = /(how\s+many|count)\s+(outstanding|unpaid)\s+charges?/i.test(lc);
  const countAvailablePropsMatch = /(how\s+many|count).*(available)\s+properties(?:\s+in\s+([a-z\s]+))?/i.exec(lc) || /(how\s+many|count)\s+properties\s+are\s+available(?:\s+in\s+([a-z\s]+))?/i.exec(lc);
  const adminConfirmPayment = /^confirm\s+payment\s+([a-z0-9-]+)/i.exec(text || "");
  const adminRejectPayment = /^reject\s+payment\s+([a-z0-9-]+)/i.exec(text || "");
  const adminListTickets = /^list\s+tickets(?:\s+status\s*:\s*(pending|assigned|in[_\s-]?progress|completed|all))?/i.exec(text || "");
  const adminCreateCharge = /^create\s+charge\s+lease\s+([a-z0-9-]+)\s+(\d+(?:\.\d{1,2})?)\s+(.+)/i.exec(text || "");

  if (wantsHelp) {
    const prefix = isAdminLike(role)
      ? "I can help with quick admin lookups and counts."
      : "I can help with your account, lease, and requests.";
    return `${prefix}\n\n${commandsText(role)}`;
  }

  if (wantsClear) {
    try {
      const convId = await ensureConvForUser(userId);
      await assistantMessages.clearConversation(convId);
      await seedGreetingIfEmpty(userId, convId, role);
      return "Chat cleared. I’ve reset the conversation and posted a fresh welcome message.";
    } catch (e) {
      return `I couldn't clear the chat (${e?.message || e}).`;
    }
  }

  // Admin-only handlers FIRST so admin phrases like "overdue" don't fall into tenant flows
  if (isAdminLike(role)) {
    if (adminSearchTenants) {
      try {
        const query = adminSearchTenants[2].trim();
        const res = await usersServices.getUsers({ search: query, limit: 5, page: 1 });
        const users = Array.isArray(res?.users) ? res.users : [];
        if (!users.length) return `No tenants matched "${query}".`;
        const lines = users.map(u => `• ${u.first_name || ''} ${u.last_name || ''} — ${u.email || ''}`.trim());
        return `Top matches for "${query}":\n${lines.join('\n')}`;
      } catch (e) {
        return `Search failed (${e?.message || e}).`;
      }
    }

    if (adminOverdueCharges) {
      try {
        const res = await chargesServices.getAllCharges({ status: 'OVERDUE', limit: 5, page: 1 });
        const rows = Array.isArray(res?.data) ? res.data : [];
        if (!rows.length) return "No overdue charges right now.";
        const lines = rows.slice(0, 5).map(c => `• ${c.tenant_name || 'Tenant'} — ${c.description || c.charge_type || 'Charge'} ${c.amount} (due ${new Date(c.due_date || c.charge_date || Date.now()).toLocaleDateString()})`);
        return `Overdue charges:\n${lines.join('\n')}`;
      } catch (e) {
        return `Failed to list overdue charges (${e?.message || e}).`;
      }
    }

    if (adminCountOverdueCharges) {
      try {
        const data = await chargesServices.getAllCharges({ status: 'OVERDUE', page: 1, limit: 1 });
        const total = Number(data?.total || 0);
        return `${total} overdue charge${total === 1 ? '' : 's'}.`;
      } catch (e) { return `Failed to count overdue charges (${e?.message || e}).`; }
    }

    if (adminDueSoonCharges) {
      try {
        const res = await chargesServices.getAllCharges({ status: 'DUE-SOON', limit: 5, page: 1 });
        const rows = Array.isArray(res?.data) ? res.data : [];
        if (!rows.length) return "No charges due soon (next 3 days).";
        const lines = rows.slice(0, 5).map(c => `• ${c.tenant_name || 'Tenant'} — ${c.description || c.charge_type || 'Charge'} ${c.amount} (due ${new Date(c.due_date || c.charge_date || Date.now()).toLocaleDateString()})`);
        return `Charges due soon:\n${lines.join('\n')}`;
      } catch (e) {
        return `Failed to list due-soon charges (${e?.message || e}).`;
      }
    }

    if (adminCountDueSoonCharges) {
      try {
        const data = await chargesServices.getAllCharges({ status: 'DUE-SOON', page: 1, limit: 1 });
        const total = Number(data?.total || 0);
        return `${total} charge${total === 1 ? '' : 's'} due soon.`;
      } catch (e) { return `Failed to count due-soon charges (${e?.message || e}).`; }
    }

    if (adminPendingPayments) {
      try {
        const res = await paymentsServices.getAllPayments({ status: 'Pending', limit: 5, page: 1 });
        const rows = Array.isArray(res?.rows) ? res.rows : [];
        if (!rows.length) return "No pending payments.";
        const lines = rows.slice(0, 5).map(p => `• ${p.payment_id} — ${p.tenant_name || ''} ${p.amount_paid} (${p.payment_method || 'method?'})`);
        return `Pending payments:\n${lines.join('\n')}`;
      } catch (e) {
        return `Failed to list pending payments (${e?.message || e}).`;
      }
    }

    if (adminCountOutstandingCharges) {
      try {
        const stats = await chargesServices.getChargesStats();
        const total = Number(stats?.outstanding || 0);
        return `${total} outstanding charge${total === 1 ? '' : 's'}.`;
      } catch (e) { return `Failed to count outstanding charges (${e?.message || e}).`; }
    }

    if (adminConfirmPayment) {
      try {
        const id = adminConfirmPayment[1];
        await paymentsServices.updatePaymentById(id, { status: 'confirm', user_id: String(userId) }, String(userId));
        return `Payment ${id} confirmed.`;
      } catch (e) {
        return `Failed to confirm payment (${e?.message || e}).`;
      }
    }

    if (adminRejectPayment) {
      try {
        const id = adminRejectPayment[1];
        await paymentsServices.updatePaymentById(id, { status: 'reject', user_id: String(userId) }, String(userId));
        return `Payment ${id} rejected.`;
      } catch (e) {
        return `Failed to reject payment (${e?.message || e}).`;
      }
    }

    if (adminListTickets) {
      try {
        const raw = adminListTickets[1];
        let status = raw ? raw.replace(/[_\s-]+/g, '_').toUpperCase() : 'ALL';
        if (status === 'ALL') status = undefined;
        const res = await ticketsServices.getTickets({ status, page: 1, limit: 5 });
        const rows = Array.isArray(res?.tickets) ? res.tickets : [];
        if (!rows.length) return `No tickets${status ? ' with status ' + status : ''}.`;
        const lines = rows.slice(0, 5).map(t => `• ${t.ticket_title || 'Ticket'} — ${t.ticket_status} (${t.property_name || 'N/A'})`);
        return `Tickets${status ? ' [' + status + ']' : ''}:\n${lines.join('\n')}`;
      } catch (e) {
        return `Failed to list tickets (${e?.message || e}).`;
      }
    }

    if (adminCreateCharge) {
      try {
        const leaseId = adminCreateCharge[1];
        const amount = Number(adminCreateCharge[2]);
        const description = adminCreateCharge[3];
        const now = new Date();
        const due = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        await chargesServices.createCharge({
          lease_id: leaseId,
          charge_type: 'Manual',
          description,
          amount,
          charge_date: now,
          due_date: due,
          is_recurring: 0,
          status: 'Unpaid',
        });
        return `Charge created for lease ${leaseId}: ₱${amount} — ${description}`;
      } catch (e) {
        return `Failed to create charge (${e?.message || e}).`;
      }
    }
  }

  if (wantsProfile) {
    try {
      const user = await usersServices.getSingleUserById(String(userId));
      if (!user) return "I couldn't find your profile.";
      const { password_hash, ...safe } = user;
      const summary = [
        safe.full_name ? `Name: ${safe.full_name}` : null,
        safe.email ? `Email: ${safe.email}` : null,
        safe.phone_number ? `Phone: ${safe.phone_number}` : null,
      ].filter(Boolean).join("\n");
      return summary || "I found your profile, but there are no public fields to display.";
    } catch (e) {
      return `Sorry, I couldn't load your profile (${e?.message || e}).`;
    }
  }

  if (wantsFaqs) {

  if (wantsAbout) {
    try {
      const data = await faqsServices.getAllFaqs(); // fallback: use company details instead
    } catch {}
    try {
      const about = await (await import('./aboutUsServices.js')).default.getAboutUs();
      const row = Array.isArray(about?.data) && about.data.length ? about.data[0] : null;
      if (!row) return "About information is not available yet.";
      const lines = [];
      if (row.story_section_title) lines.push(row.story_section_title);
      if (row.story_content) lines.push(row.story_content);
      if (row.mission) lines.push(`Mission: ${row.mission}`);
      if (row.vision) lines.push(`Vision: ${row.vision}`);
      return lines.join('\n\n');
    } catch (e) {
      return `Sorry, I couldn't load the About Us content (${e?.message || e}).`;
    }
  }

  if (wantsInvoice) {
    try {
      const paymentId = wantsInvoice[1];
      const invSvc = (await import('./invoicesServices.js')).getInvoiceByPaymentId;
      const data = await invSvc(paymentId);
      if (!data) return `No invoice found for payment ${paymentId}.`;
      const lines = [];
      if (data.invoice?.id) lines.push(`Invoice: ${data.invoice.id} (${data.invoice.status})`);
      if (data.payment?.id) lines.push(`Payment: ${data.payment.id} — ${data.payment.method || ''} on ${new Date(data.payment.date||Date.now()).toLocaleDateString()}`);
      if (data.property?.name) lines.push(`Property: ${data.property.name}${data.property.address ? ' — ' + data.property.address : ''}`);
      if (Array.isArray(data.items) && data.items.length) {
        lines.push('Items:');
        lines.push(...data.items.slice(0,5).map(it => `• ${it.description || it.type || 'Item'} — ${it.amount}`));
      }
      if (data.invoice?.total !== undefined) lines.push(`Total: ${data.invoice.total}`);
      return lines.join('\n');
    } catch (e) {
      return `Sorry, I couldn't load that invoice (${e?.message || e}).`;
    }
  }
    try {
      const list = await faqsServices.getAllFaqs();
      const actives = (list || []).filter(f => f.is_active !== 0);
      const top = actives.slice(0, 5);
      if (!top.length) return "No FAQs available right now.";
      const lines = top.map(f => `• ${f.question}`);
      return `Here are some common questions:\n${lines.join('\n')}`;
    } catch (e) {
      return `Sorry, I couldn't load FAQs (${e?.message || e}).`;
    }
  }

  if (wantsLease) {
    try {
      const leases = await leaseServices.getLeaseByUserId(String(userId));
      const sorted = (leases || []).slice().sort((a, b) => new Date(b.lease_start_date || 0) - new Date(a.lease_start_date || 0));
      const current = sorted.find(l => String(l.lease_status).toUpperCase() === 'ACTIVE')
        || sorted.find(l => String(l.lease_status).toUpperCase() === 'PENDING')
        || sorted[0]
        || null;
      if (!current) return "I couldn't find a lease for you.";
      const lines = [];
      if (current.property_name) lines.push(`Property: ${current.property_name}`);
      if (current.property_address) lines.push(`Address: ${current.property_address}`);
      if (current.monthly_rent) lines.push(`Monthly Rent: ${current.monthly_rent}`);
      if (current.payment_frequency) lines.push(`Payment Frequency: ${current.payment_frequency}`);
      if (current.lease_start_date) lines.push(`Start: ${new Date(current.lease_start_date).toLocaleDateString()}`);
      if (current.lease_end_date) lines.push(`End: ${new Date(current.lease_end_date).toLocaleDateString()}`);
      if (current.lease_status) lines.push(`Status: ${current.lease_status}`);
      return lines.join("\n") || "I found a lease, but couldn't format the details.";
    } catch (e) {
      return `Sorry, I couldn't load your lease (${e?.message || e}).`;
    }
  }

  if (wantsPayments) {
    try {
      const statusMatch = lc.match(/paid|pending|overdue|all/);
      const status = statusMatch ? statusMatch[0].toUpperCase() : "ALL";
      // For admins without a specific admin command, show global if not restricting to user
      if (isAdminLike(role)) {
        const data = await paymentsServices.getAllPayments({ status: status === 'PAID' ? 'Confirmed' : (status === 'ALL' ? undefined : status), page: 1, limit: 20 });
        const rows = Array.isArray(data?.rows) ? data.rows : [];
        if (!rows.length) return `No ${status === 'ALL' ? '' : status.toLowerCase() + ' '}payments found.`;
        const top5 = rows.slice(0, 5);
        const lines = top5.map(p => `• ${new Date(p.created_at || Date.now()).toLocaleDateString()} - ${p.amount_paid} (${p.status}) — ${p.tenant_name || ''}`);
        const suffix = rows.length > 5 ? `\n…and ${rows.length - 5} more.` : '';
        return `Payments:\n${lines.join('\n')}${suffix}`;
      }
      const data = await paymentsServices.getPaymentsByUserId(String(userId), { page: 1, limit: 20 });
      let rows = Array.isArray(data?.rows) ? data.rows : [];
      if (status !== "ALL") rows = rows.filter(r => String(r.status).toUpperCase() === status);
      if (rows.length === 0) return `No ${status === 'ALL' ? '' : status.toLowerCase() + ' '}payments found.`;
      const top5 = rows.slice(0, 5);
      const lines = top5.map(p => `• ${new Date(p.payment_date || p.created_at || Date.now()).toLocaleDateString()} - ${p.amount} (${p.status})`);
      const suffix = rows.length > 5 ? `\n…and ${rows.length - 5} more.` : '';
      return `Here are your ${status === 'ALL' ? '' : status.toLowerCase() + ' '}payments:\n${lines.join('\n')}${suffix}`;
    } catch (e) {
      return `Sorry, I couldn't load your payments (${e?.message || e}).`;
    }
  }

  if (wantsCharges) {
    try {
      const leases = await leaseServices.getLeaseByUserId(String(userId));
      const sorted = (leases || []).slice().sort((a, b) => new Date(b.lease_start_date || 0) - new Date(a.lease_start_date || 0));
      const current = sorted.find(l => String(l.lease_status).toUpperCase() === 'ACTIVE')
        || sorted.find(l => String(l.lease_status).toUpperCase() === 'PENDING')
        || sorted[0]
        || null;
      if (!current || !current.lease_id) return "I couldn't find your current lease to compute charges.";
      const charges = await chargesServices.getChargeByLeaseId(current.lease_id, {});
      const outstanding = (charges || []).filter(c => String(c.canonical_status || '').toUpperCase() !== 'PAID' && String(c.status || '') !== 'Waived');
      if (outstanding.length === 0) return "You're all caught up. No outstanding charges.";
      const top5 = outstanding.slice(0, 5);
      const lines = top5.map(c => `• ${new Date(c.due_date || c.charge_date || Date.now()).toLocaleDateString()} - ${c.description || c.charge_type || 'Charge'}: ${c.amount} (${c.canonical_status || c.status || 'Unpaid'})`);
      const suffix = outstanding.length > 5 ? `\n…and ${outstanding.length - 5} more outstanding charges.` : '';
      return `Outstanding charges:\n${lines.join('\n')}${suffix}`;
    } catch (e) {
      return `Sorry, I couldn't load your charges (${e?.message || e}).`;
    }
  }

  if (wantsTickets) {
    try {
      const data = await ticketsServices.getTicketsByUserId(String(userId), { page: 1, limit: 5 });
      const rows = Array.isArray(data?.tickets) ? data.tickets : [];
      if (!rows.length) return "You have no recent tickets.";
      const lines = rows.map(t => `• ${t.ticket_title || 'Ticket'} - ${t.ticket_status} (${new Date(t.created_at || Date.now()).toLocaleDateString()})`);
      return `Your recent tickets:\n${lines.join('\n')}`;
    } catch (e) {
      return `Sorry, I couldn't load your tickets (${e?.message || e}).`;
    }
  }

  if (wantsCreateTicket) {
    try {
      // Simple parsing: "create ticket - Title: Description"
      const m = String(text).match(/create .*ticket\s*[-–:]\s*([^:]+):\s*(.+)$/i);
      if (!m) {
        return "To create a ticket, use: create ticket - <Title>: <Description>";
      }
      const ticket_title = m[1].trim().slice(0, 120);
      const description = m[2].trim().slice(0, 1000);
      await ticketsServices.createTicket({ ticket_title, description, priority: 'LOW', request_type: 'Maintenance', user_id: String(userId) }, String(userId));
      return `Ticket created: ${ticket_title}`;
    } catch (e) {
      return `Sorry, I couldn't create the ticket (${e?.message || e}).`;
    }
  }

  if (wantsAvailableProps) {
    try {
      const cityMatch = lc.match(/\b(?:in|at)\s+([a-z\s]+)$/i);
      const rangeMatch = lc.match(/(?:between|from)\s+([\d,.]+)\s*(?:to|and)\s*([\d,.]+)/i);
      const q = { property_status: 'Available', limit: 5, page: 1 };
      if (cityMatch && cityMatch[1]) q.city = cityMatch[1].trim().replace(/\s+/g,' ');
      if (rangeMatch) {
        const min = Number(String(rangeMatch[1]).replace(/[,]/g,''));
        const max = Number(String(rangeMatch[2]).replace(/[,]/g,''));
        if (!isNaN(min)) q.min_rent = min;
        if (!isNaN(max)) q.max_rent = max;
      }
      const res = await propertiesServices.getProperties(q);
      const props = Array.isArray(res?.properties) ? res.properties : [];
      if (!props.length) return "No available properties found right now.";
      const lines = props.map(p => `• ${p.property_name}${p.city ? ` — ${p.city}` : ''}${p.base_rent ? ` (₱${p.base_rent})` : ''}`);
      const suffix = (typeof res.total === 'number' && res.total > props.length) ? `\n…and ${res.total - props.length} more.` : '';
      return `Available properties${q.city ? ` in ${q.city}` : ''}${(q.min_rent||q.max_rent)?' (filtered)':''}:\n${lines.join('\n')}${suffix}`;
    } catch (e) {
      return `Sorry, I couldn't list properties (${e?.message || e}).`;
    }
  }

  if (countAvailablePropsMatch) {
    try {
      const city = (countAvailablePropsMatch[3] || countAvailablePropsMatch[2] || '').trim();
      const q = { property_status: 'Available', limit: 1, page: 1 };
      if (city) q.city = city;
      const res = await propertiesServices.getProperties(q);
      const total = Number(res?.total || 0);
      return `${total} available propert${total === 1 ? 'y' : 'ies'}${city?` in ${city}`:''}.`;
    } catch (e) {
      return `Sorry, I couldn't count available properties (${e?.message || e}).`;
    }
  }

  if (wantsCompany) {
    try {
      const rows = await companyDetailsServices.getCompanyDetails();
      const info = Array.isArray(rows) && rows.length ? rows[0] : null;
      if (!info) return "Company details are not configured yet.";
      const lines = [];
      if (info.company_name) lines.push(`Name: ${info.company_name}`);
      if (info.email) lines.push(`Email: ${info.email}`);
      if (info.phone_number) lines.push(`Phone: ${info.phone_number}`);
      const addr = [info.house_no, info.street_address, info.city, info.province, info.zip_code, info.country].filter(Boolean).join(', ');
      if (addr) lines.push(`Address: ${addr}`);
      return lines.join('\n') || "Company details are not available.";
    } catch (e) {
      return `Sorry, I couldn't load company info (${e?.message || e}).`;
    }
  }

  // Admin-only handlers
  if (isAdminLike(role)) {
    if (adminReportFinancial) {
      try {
        const rep = (await import('./reportsServices.js')).default;
        const data = await rep.getFinancialSummary({});
        const parts = [
          `Outstanding balances: ${data.outstandingBalances}`,
          `Deposits — Advance: ${data.depositsSummary?.advance || 0}, Security: ${data.depositsSummary?.security || 0}`,
        ];
        return parts.join('\n');
      } catch (e) { return `Failed to get financial report (${e?.message || e}).`; }
    }
    if (adminReportTenants) {
      try {
        const rep = (await import('./reportsServices.js')).default;
        const data = await rep.getTenantSummary({});
        return `Tenants — Active: ${data.activeVsInactive?.active || 0}, Inactive: ${data.activeVsInactive ? (data.activeVsInactive.inactive || 0) : 0}. Overdue: ${data.tenantsWithOverdue || 0}`;
      } catch (e) { return `Failed to get tenant report (${e?.message || e}).`; }
    }
    if (adminReportProperties) {
      try {
        const rep = (await import('./reportsServices.js')).default;
        const data = await rep.getPropertyLeaseSummary({});
        const occ = data.occupancyPerProperty?.slice(0,5).map(r => `• ${r.property_name || r.property_id}: ${r.activeLeases}/${r.totalLeases}`).join('\n') || 'No data';
        return `Property occupancy:\n${occ}`;
      } catch (e) { return `Failed to get property report (${e?.message || e}).`; }
    }
    if (adminReportMaintenance) {
      try {
        const rep = (await import('./reportsServices.js')).default;
        const data = await rep.getMaintenanceSummary({});
        const byStatus = (data.ticketsByStatus||[]).map(r => `${r.status}: ${r.total}`).join(', ');
        return `Maintenance — Avg resolution (hrs): ${data.averageResolutionHours || 0}. Status: ${byStatus || 'No data'}`;
      } catch (e) { return `Failed to get maintenance report (${e?.message || e}).`; }
    }
    if (adminSearchTenants) {
      try {
        const query = adminSearchTenants[2].trim();
        const res = await usersServices.getUsers({ search: query, limit: 5, page: 1 });
        const users = Array.isArray(res?.users) ? res.users : [];
        if (!users.length) return `No tenants matched "${query}".`;
        const lines = users.map(u => `• ${u.first_name || ''} ${u.last_name || ''} — ${u.email || ''}`.trim());
        return `Top matches for "${query}":\n${lines.join('\n')}`;
      } catch (e) {
        return `Search failed (${e?.message || e}).`;
      }
    }

    if (adminOverdueCharges) {
      try {
        const res = await chargesServices.getAllCharges({ status: 'OVERDUE', limit: 5, page: 1 });
        const rows = Array.isArray(res?.data) ? res.data : [];
        if (!rows.length) return "No overdue charges right now.";
        const lines = rows.slice(0, 5).map(c => `• ${c.tenant_name || 'Tenant'} — ${c.description || c.charge_type || 'Charge'} ${c.amount} (due ${new Date(c.due_date || c.charge_date || Date.now()).toLocaleDateString()})`);
        return `Overdue charges:\n${lines.join('\n')}`;
      } catch (e) {
        return `Failed to list overdue charges (${e?.message || e}).`;
      }
    }

    if (adminDueSoonCharges) {
      try {
        const res = await chargesServices.getAllCharges({ status: 'DUE-SOON', limit: 5, page: 1 });
        const rows = Array.isArray(res?.data) ? res.data : [];
        if (!rows.length) return "No charges due soon (next 3 days).";
        const lines = rows.slice(0, 5).map(c => `• ${c.tenant_name || 'Tenant'} — ${c.description || c.charge_type || 'Charge'} ${c.amount} (due ${new Date(c.due_date || c.charge_date || Date.now()).toLocaleDateString()})`);
        return `Charges due soon:\n${lines.join('\n')}`;
      } catch (e) {
        return `Failed to list due-soon charges (${e?.message || e}).`;
      }
    }

    if (adminPendingPayments) {
      try {
        const res = await paymentsServices.getAllPayments({ status: 'Pending', limit: 5, page: 1 });
        const rows = Array.isArray(res?.rows) ? res.rows : [];
        if (!rows.length) return "No pending payments.";
        const lines = rows.slice(0, 5).map(p => `• ${p.payment_id} — ${p.tenant_name || ''} ${p.amount_paid} (${p.payment_method || 'method?'})`);
        return `Pending payments:\n${lines.join('\n')}`;
      } catch (e) {
        return `Failed to list pending payments (${e?.message || e}).`;
      }
    }

    if (adminConfirmPayment) {
      try {
        const id = adminConfirmPayment[1];
        await paymentsServices.updatePaymentById(id, { status: 'confirm', user_id: String(userId) }, String(userId));
        return `Payment ${id} confirmed.`;
      } catch (e) {
        return `Failed to confirm payment (${e?.message || e}).`;
      }
    }

    if (adminRejectPayment) {
      try {
        const id = adminRejectPayment[1];
        await paymentsServices.updatePaymentById(id, { status: 'reject', user_id: String(userId) }, String(userId));
        return `Payment ${id} rejected.`;
      } catch (e) {
        return `Failed to reject payment (${e?.message || e}).`;
      }
    }

    if (adminListTickets) {
      try {
        const raw = adminListTickets[1];
        let status = raw ? raw.replace(/[_\s-]+/g, '_').toUpperCase() : 'ALL';
        if (status === 'ALL') status = undefined;
        const res = await ticketsServices.getTickets({ status, page: 1, limit: 5 });
        const rows = Array.isArray(res?.tickets) ? res.tickets : [];
        if (!rows.length) return `No tickets${status ? ' with status ' + status : ''}.`;
        const lines = rows.slice(0, 5).map(t => `• ${t.ticket_title || 'Ticket'} — ${t.ticket_status} (${t.property_name || 'N/A'})`);
        return `Tickets${status ? ' [' + status + ']' : ''}:\n${lines.join('\n')}`;
      } catch (e) {
        return `Failed to list tickets (${e?.message || e}).`;
      }
    }

    if (adminCreateCharge) {
      try {
        const leaseId = adminCreateCharge[1];
        const amount = Number(adminCreateCharge[2]);
        const description = adminCreateCharge[3];
        const now = new Date();
        const due = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        await chargesServices.createCharge({
          lease_id: leaseId,
          charge_type: 'Manual',
          description,
          amount,
          charge_date: now,
          due_date: due,
          is_recurring: 0,
          status: 'Unpaid',
        });
        return `Charge created for lease ${leaseId}: ₱${amount} — ${description}`;
      } catch (e) {
        return `Failed to create charge (${e?.message || e}).`;
      }
    }
  } else {
    // Tenant attempted admin commands
    if (adminSearchTenants || adminOverdueCharges || adminDueSoonCharges || adminPendingPayments || adminConfirmPayment || adminRejectPayment || adminListTickets || adminCreateCharge) {
      return "This action requires an admin account.";
    }
  }

  return null; // unknown intent; let Gemini try if configured
}

export async function ensureConversation(userId) {
  const convId = await ensureConvForUser(userId);
  return { conversationId: convId };
}

export async function sendTextMessage(userId, conversationId, text, opts = {}) {
  if (!text || !String(text).trim()) throw new Error("Message text is required");
  const convId = conversationId || await ensureConvForUser(userId);
  const role = opts?.role;
  const tmpId = opts?.tmpId || null;

  // Record user message (outgoing)
  await pushMessage(convId, {
    direction: "outgoing",
    metadata: { sender: "user", userKey: String(userId), direction: "outgoing", tmpId },
    payload: { type: "text", text: String(text) },
  });

  // Prefer precise local intents first; then use Gemini as fallback
  let usedGemini = false;
  let reply = await routeLocalIntent(userId, text, role);
  if (!reply) {
    const context = { hints: ["profile", "lease", "payments", "properties", "counts"], userId: String(userId) };
    reply = await tryGeminiReply(text, context, role);
    usedGemini = Boolean(reply);
  }

  // Final fallback
  if (!reply) {
    reply = isAdminLike(role)
      ? "Try: 'show my profile' or 'show my payments [paid|pending|overdue|all]'. For tenant/property actions, use the admin pages."
      : "I can help with: 'show my profile', 'show my lease', or 'show my payments [paid|pending|overdue|all]'.";
  }

  // Record assistant reply (incoming)
  const tag = usedGemini && String(process.env.ASSISTANT_SHOW_MODEL_TAG || '').toLowerCase() === 'true' ? ' · via Gemini' : '';
  const finalText = reply + tag;
  if (usedGemini && process.env.NODE_ENV !== 'production') {
    console.info(`[localAssistant] Gemini used for conversation ${convId}`);
  }
  await pushMessage(convId, {
    direction: "incoming",
    metadata: { sender: "bot", direction: "incoming" },
    payload: { type: "text", text: finalText },
  });

  return { ok: true };
}

export async function listMessages(userId, conversationId, limit = 30) {
  const convId = conversationId || await ensureConvForUser(userId);
  const messages = await assistantMessages.listMessages(convId, limit);
  return { conversationId: convId, messages };
}

export async function seedGreetingIfEmpty(userId, conversationId, role) {
  const convId = conversationId || await ensureConvForUser(userId);
  const has = await assistantMessages.hasAnyMessage(convId);
  if (has) return;
  const isAdmin = isAdminLike(role);
  const tips = isAdmin
    ? [
        "Type 'overdue charges' or 'pending payments' to see quick lists.",
        "Try 'search tenants <name>' or 'list tickets status: in_progress'.",
        "Use the admin pages for edits (Payments, Leases, Tenants).",
      ]
    : [
        "Ask 'show my lease' or 'show my payments pending'.",
        "Create a request: 'create ticket - Leaky faucet: The kitchen tap is dripping'.",
        "You can type 'help' anytime; I won't ask for your password.",
      ];
  const greetingHead = isAdmin
    ? `Hi! I can help with quick admin lookups like payments, charges, tenants, tickets, and simple stats.`
    : `Hi! I can help with your profile, lease, payments, charges, tickets, FAQs, and more.`;
  const greeting = `${greetingHead}\n- ${tips.join("\n- ")}\n\n${commandsText(role)}`;
  await pushMessage(convId, {
    direction: "incoming",
    metadata: { sender: "bot", reason: "auto-greet", role },
    payload: { type: "text", text: greeting },
  });
}

export default {
  ensureConversation,
  sendTextMessage,
  listMessages,
  seedGreetingIfEmpty,
};
