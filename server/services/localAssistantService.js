import usersServices from "./usersServices.js";
import paymentsServices from "./paymentsServices.js";
import leaseServices from "./leaseServices.js";
import faqsServices from "./faqsServices.js";
import ticketsServices from "./ticketsServices.js";
import chargesServices from "./chargesServices.js";
import propertiesServices from "./propertiesServices.js";
import companyDetailsServices from "./companyDetailsServices.js";
import gemini from "./geminiService.js";
import { documentsService } from "./documentsService.js";
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
      const handled = await handleParsedIntent(context.userId || null, role, parsed.intent, parsed.params || {}, parsed.detail_level || 'minimal', promptText);
      if (handled) {
        // If handler returned structured data, pass through Gemini for phrasing and preserve meta
        if (typeof handled === 'object' && handled !== null) {
          const phrased = await gemini.generateText({
            text: promptText,
            context: {
              intent: parsed.intent,
              detail_level: parsed.detail_level || 'minimal',
              raw: handled.raw,
              data: handled.data || null
            },
            system: gemini.getSystemResponsePrompt()
          });
          return { text: (phrased || handled.raw || '').trim(), meta: handled.meta || null };
        }
        // Backward compatibility if handler returned string
        const phrased = await gemini.generateText({
          text: `Rephrase data response: ${handled}`,
          context: { intent: parsed.intent, detail_level: parsed.detail_level || 'minimal' },
          system: gemini.getSystemResponsePrompt()
        });
        return { text: (phrased || handled || '').trim(), meta: null };
      }
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
    return text ? { text: (text || "").trim() } : null;
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn("[localAssistant] Gemini generate failed:", e?.message || e);
    return null;
  }
}

async function handleParsedIntent(userId, role, intent, params = {}, detailLevel = 'minimal', originalUtterance = '') {
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
        if (!sorted.length) return "I couldn't find a lease for you.";
        const wantAll = (detailLevel === 'full') || /\b(all|list|every)\b/.test(String(originalUtterance||'').toLowerCase());
        if (wantAll && sorted.length > 1) {
          const blocks = sorted.map(l => {
            const parts = [];
            if (l.property_name) parts.push(`${l.property_name}`);
            if (l.monthly_rent) parts.push(`${l.monthly_rent}`);
            const dates = [l.lease_start_date?new Date(l.lease_start_date).toLocaleDateString():null, l.lease_end_date?new Date(l.lease_end_date).toLocaleDateString():null].filter(Boolean).join(' - ');
            if (dates) parts.push(dates);
            if (l.lease_status) parts.push(String(l.lease_status));
            return `• ${parts.join(' — ')}`;
          });
          return `Your leases:\n${blocks.join('\n')}`;
        }
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
      case "list_tenants": {
        if (!isAdmin) return { raw: "This action requires an admin account." };
        const rawStatus = (params?.status || '').toString().toUpperCase();
        const status = ["ACTIVE","INACTIVE","ALL"].includes(rawStatus) ? rawStatus : undefined;
        const wantFull = detailLevel === 'full' || /\ball\b/.test(originalUtterance.toLowerCase());
        const limit = wantFull ? 250 : 10;
        const res = await usersServices.getUsers({ status: status && status !== 'ALL' ? status : undefined, page: 1, limit });
        const users = Array.isArray(res?.users) ? res.users : [];
        if (!users.length) return { raw: "No tenants found." };
        const lines = users.map(u => `${u.first_name || ''} ${u.last_name || ''}`.trim()).filter(Boolean);
        const total = res?.pagination?.totalUsers || users.length;
        const truncated = total > users.length;
        const rawText = `Tenants${status?` [${status}]`:''}: ${lines.join(', ')}${truncated?` (and ${total - users.length} more)`:''}`;
        const meta = truncated ? { followup: 'expand-list', target: 'tenants', params: { status } } : null;
        return { raw: rawText, data: { total, returned: users.length, status, truncated, users }, meta };
      }
      case "count_tenants": {
        if (!isAdmin) return { raw: "This action requires an admin account." };
        const raw = (params?.status || '').toString().toUpperCase();
        const status = ["ACTIVE","INACTIVE","ALL"].includes(raw) ? raw : undefined;
        const res = await usersServices.getUsers({ status: status && status !== 'ALL' ? status : undefined, page: 1, limit: 1 });
        const total = Number(res?.pagination?.totalUsers || 0);
        return { raw: `${total} tenant${total === 1 ? '' : 's'}${status?` [${status}]`:''}.`, data: { total, status } };
      }
      case "count_properties": {
        const wantAvailable = String(params?.status || '').toLowerCase() === 'available';
        const q = { limit: 1, page: 1 };
        if (wantAvailable) q.property_status = 'Available';
        const res = await propertiesServices.getProperties(q);
        const total = Number(res?.total || 0);
        const rawText = wantAvailable ? `${total} available propert${total === 1 ? 'y' : 'ies'}.` : `${total} propert${total === 1 ? 'y' : 'ies'} in the system.`;
        return { raw: rawText, data: { total, availableOnly: wantAvailable } };
      }
      case "search_properties": {
        if (!isAdmin) return { raw: "This action requires an admin account." };
        const query = (params?.query || '').toString().trim();
        if (!query) return { raw: "Provide a property search query." };
        const res = await propertiesServices.getProperties({ limit: 200, page: 1 });
        const all = Array.isArray(res?.properties) ? res.properties : [];
        if (!all.length) return { raw: "There are no properties in the system yet." };
        // Use fuzzy search utilities from gemini service
        const matches = gemini.fuzzyFilterProperties(query, all, { threshold: 0.5, limit: 5 });
        if (matches.length === 0) return { raw: `No properties matched "${query}".` };
        if (matches.length === 1) {
          const p = matches[0].property;
          const parts = [p.property_name, p.city, p.base_rent ? `₱${p.base_rent}` : null].filter(Boolean).join(' — ');
          return { raw: `Found: ${parts}`, data: { match: p } };
        }
        const amb = { status: 'ambiguous', choices: matches };
        const msg = gemini.generatePropertyDisambiguationMessage(amb) || `Multiple properties matched "${query}".`;
        return { raw: msg, data: { ambiguous: true, choices: matches.map(m => m.property) }, meta: { followup: 'disambiguate', target: 'property', choices: matches.map((m,i)=>({ index: i+1, id: m.property.property_id, name: m.property.property_name, city: m.property.city, base_rent: m.property.base_rent })) } };
      }
      case "show_tenant": {
        if (!isAdmin) return { raw: "This action requires an admin account." };
        const query = (params?.query || '').toString().trim();
        const requested = (params?.fields || '').toString().toLowerCase();
        if (!query) return { raw: "Provide a tenant name to look up." };
        const res = await usersServices.getUsers({ search: query, limit: 50, page: 1 });
        const users = Array.isArray(res?.users) ? res.users : [];
        if (!users.length) return { raw: `No tenant matched "${query}".` };
        // fuzzy refine
        const fuzzy = gemini.fuzzyFilterTenants(query, users, { threshold: 0.4, limit: 5 });
        if (fuzzy.length === 0) return { raw: `No tenant matched "${query}".` };
        if (fuzzy.length > 1 && detailLevel !== 'full') {
          return { raw: gemini.generateDisambiguationMessage({ status: 'ambiguous', choices: fuzzy }), data: { ambiguous: true, choices: fuzzy.map(f => f.tenant) }, meta: { followup: 'disambiguate', target: 'tenant', choices: fuzzy.map((f,i)=>({ index: i+1, id: f.tenant.user_id, name: [f.tenant.first_name,f.tenant.middle_name,f.tenant.last_name].filter(Boolean).join(' '), email: f.tenant.email, phone: f.tenant.phone_number, status: f.tenant.status })) } };
        }
        const chosen = fuzzy[0].tenant;
        const profile = {
          name: [chosen.first_name, chosen.middle_name, chosen.last_name].filter(Boolean).join(' '),
          email: chosen.email,
          phone: chosen.phone_number,
          status: chosen.status,
        };
        let fields = [];
        if (!requested || requested === 'all' || requested === 'profile') {
          fields = Object.entries(profile).filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`);
        } else {
          if (/phone|number/.test(requested) && profile.phone) fields.push(`phone: ${profile.phone}`);
          if (/email|contact/.test(requested) && profile.email) fields.push(`email: ${profile.email}`);
          if (!fields.length) fields = Object.entries(profile).filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`);
        }
        return { raw: `Tenant: ${profile.name}. ${fields.join('; ')}`, data: { profile } };
      }
      case "list_tenants_outstanding_charges": {
        if (!isAdmin) return { raw: "This action requires an admin account." };
        // Pull a wide set of unpaid/overdue charges
        const overdue = await chargesServices.getAllCharges({ status: 'OVERDUE', limit: 500, page: 1 });
        const unpaid = await chargesServices.getAllCharges({ status: 'UNPAID', limit: 500, page: 1 });
        const rows = [...(Array.isArray(overdue?.data)?overdue.data:[]), ...(Array.isArray(unpaid?.data)?unpaid.data:[])];
        if (!rows.length) return { raw: "No tenants have outstanding charges right now." };
        const agg = {};
        rows.forEach(r => {
          const key = r.tenant_name || r.tenant_id || 'Tenant';
          if (!agg[key]) agg[key] = { total: 0, count: 0, samples: [] };
          const amt = Number(r.amount || r.original_amount || 0);
          agg[key].total += amt;
          agg[key].count += 1;
          if (agg[key].samples.length < 3) agg[key].samples.push({ desc: r.description || r.charge_type, amount: amt, due: r.due_date || r.charge_date });
        });
        const entries = Object.entries(agg).sort((a,b) => b[1].total - a[1].total);
        const wantFull = detailLevel === 'full' || /\ball\b/.test(originalUtterance.toLowerCase());
        const max = wantFull ? entries.length : Math.min(entries.length, 15);
        const lines = entries.slice(0,max).map(([name, info]) => `${name}: ₱${info.total.toLocaleString()} (${info.count} charge${info.count>1?'s':''})`);
        const truncated = max < entries.length;
        const rawText = `Outstanding charges by tenant: ${lines.join('; ')}${truncated?` (and ${entries.length - max} more)`:''}`;
        const meta = truncated ? { followup: 'expand-list', target: 'tenant-charges' } : null;
        return { raw: rawText, data: { tenants: entries.map(([n,i]) => ({ name: n, total: i.total, count: i.count })), truncated }, meta };
      }
      case "company_info": {
        const rows = await companyDetailsServices.getCompanyDetails();
        const info = Array.isArray(rows) && rows.length ? rows[0] : null;
        if (!info) return { raw: "Company details are not configured yet." };
        const lines = [];
        if (info.company_name) lines.push(`Name: ${info.company_name}`);
        if (info.email) lines.push(`Email: ${info.email}`);
        if (info.phone_number) lines.push(`Phone: ${info.phone_number}`);
        const addr = [info.house_no, info.street_address, info.city, info.province, info.zip_code, info.country].filter(Boolean).join(', ');
        if (addr) lines.push(`Address: ${addr}`);
        return { raw: lines.join('\n') || "Company details are not available.", data: { company: info } };
      }
      case "list_all_documents": {
        if (!isAdmin) return { raw: "This action requires an admin account." };
        const res = await documentsService.list('');
        const files = Array.isArray(res?.files) ? res.files : [];
        if (!files.length) return { raw: "No documents stored yet." };
        const lines = files.slice(0, 50).map(f => `• ${f.filename} — ${f.folder || 'documents'} — ${new Date(f.created_at||Date.now()).toLocaleDateString()}`);
        const suffix = files.length > 50 ? `\n…and ${files.length - 50} more.` : '';
        return { raw: `All documents:\n${lines.join('\n')}${suffix}`, data: { total: files.length } };
      }
      // ---------------- Documents: tenant + admin ----------------
      case "show_user_documents": {
        // Tenant: list own documents across root/user folder
        if (!isAdmin) {
          const path = `users/${String(userId)}`;
          const res = await documentsService.list(path);
          const files = Array.isArray(res?.files) ? res.files : [];
          if (!files.length) return { raw: "You don’t have any uploaded documents yet." };
          const lines = files.slice(0, 12).map(f => `• ${f.filename} — ${new Date(f.created_at||Date.now()).toLocaleDateString()} — ${f.secure_url || ''}`);
          const suffix = files.length > 12 ? `\n…and ${files.length - 12} more.` : '';
          return { raw: `Your documents:\n${lines.join('\n')}${suffix}`, data: { total: files.length } };
        }
        // Admin: list system-wide (top level)
        const res = await documentsService.list('');
        const files = Array.isArray(res?.files) ? res.files : [];
        const lines = files.slice(0, 20).map(f => `• ${f.filename} — ${f.folder || 'documents'} — ${new Date(f.created_at||Date.now()).toLocaleDateString()}`);
        const suffix = files.length > 20 ? `\n…and ${files.length - 20} more.` : '';
        return { raw: `All documents:\n${lines.join('\n')}${suffix}`, data: { total: files.length } };
      }
      case "show_lease_documents": {
        const leaseId = String(params?.lease_id || '').trim();
        if (leaseId) {
          try {
            const full = await leaseServices.getSingleLeaseById(String(leaseId));
            const url = full && full.contract && full.contract.url ? full.contract.url : null;
            if (!url) return { raw: `No contract file stored for lease ${leaseId}.` };
            return { raw: `Lease ${leaseId} contract: ${url}`, data: { leaseId, contract_url: url } };
          } catch (e) {
            return { raw: `Failed to load lease ${leaseId} (${e?.message || e}).` };
          }
        }
        // List all user leases with contract presence
        const leases = await leaseServices.getLeaseByUserId(String(userId));
        if (!Array.isArray(leases) || !leases.length) return { raw: 'You have no leases.' };
        const lines = [];
        for (const l of leases.slice(0, 25)) {
          let contractUrl = null;
          if (l.lease_id) {
            try {
              const full = await leaseServices.getSingleLeaseById(String(l.lease_id));
              contractUrl = full && full.contract && full.contract.url ? full.contract.url : null;
            } catch {}
          }
            lines.push(`• ${l.property_name || 'Property'} — ${l.lease_id}: ${contractUrl ? contractUrl : '(no contract)'}`);
        }
        const suffix = leases.length > 25 ? `\n…and ${leases.length - 25} more.` : '';
        return { raw: `Leases & contracts:\n${lines.join('\n')}${suffix}`, data: { total: leases.length } };
      }
      case "show_ticket_documents": {
        const ticketId = String(params?.ticket_id || '').trim();
        if (!ticketId) return { raw: "Provide a ticket_id." };
        try {
          const t = await ticketsServices.getSingleTicketById(ticketId);
          const atts = Array.isArray(t?.ticket?.attachments) ? t.ticket.attachments : [];
          if (!atts.length) return { raw: `No attachments for ticket ${ticketId}.` };
          const lines = atts.slice(0, 20).map(u => `• ${u}`);
          const suffix = atts.length > 20 ? `\n…and ${atts.length - 20} more.` : '';
          return { raw: `Ticket ${ticketId} attachments:\n${lines.join('\n')}${suffix}`, data: { ticketId, total: atts.length } };
        } catch (e) {
          return { raw: `Failed to load ticket ${ticketId} (${e?.message || e}).` };
        }
      }
      case "show_invoice_documents": {
        const id = String(params?.payment_id || params?.invoice_id || '').trim();
        if (!id) return { raw: "Provide a payment_id or invoice_id." };
        try {
          const invSvc = (await import('./invoicesServices.js'));
          const data = await invSvc.getInvoiceByPaymentId(id);
          if (!data) return { raw: `No invoice found for payment ${id}.` };
          const lines = [];
          if (data.invoice?.id) lines.push(`Invoice: ${data.invoice.id} (${data.invoice.status || 'status?'})`);
          if (data.invoice?.issueDate) lines.push(`Issued: ${new Date(data.invoice.issueDate).toLocaleDateString()}`);
          if (data.payment?.id) lines.push(`Payment: ${data.payment.id} — ${data.payment.method || ''} on ${new Date(data.payment.date||Date.now()).toLocaleDateString()}`);
          if (data.payment?.reference) lines.push(`Reference: ${data.payment.reference}`);
          if (data.tenant?.name) lines.push(`Tenant: ${data.tenant.name}`);
          if (data.lease?.id) lines.push(`Lease: ${data.lease.id}`);
          if (data.property?.name) lines.push(`Property: ${data.property.name}${data.property.address?` — ${data.property.address}`:''}`);
          if (Array.isArray(data.items) && data.items.length) {
            lines.push('Items:');
            lines.push(...data.items.map(it => `• ${it.description || it.type || 'Item'} — ${it.amount}`));
          }
          if (data.charge) {
            const c = data.charge;
            lines.push('Charge:');
            if (c.description) lines.push(`• ${c.description}`);
            if (c.dueDate) lines.push(`• Due: ${new Date(c.dueDate).toLocaleDateString()}`);
            if (c.originalAmount !== null && c.originalAmount !== undefined) lines.push(`• Original: ${c.originalAmount}`);
            if (c.lateFee) lines.push(`• Late fee: ${c.lateFee}`);
            if (c.amount !== null && c.amount !== undefined) lines.push(`• Current: ${c.amount}`);
          }
          if (data.invoice?.total !== undefined) lines.push(`Total: ${data.invoice.total}`);
          lines.push('(No stored PDF file — full details shown above)');
          return { raw: lines.join('\n'), data: { id, hasItems: Array.isArray(data.items) && data.items.length } };
        } catch (e) {
          return { raw: `Failed to load invoice/payment ${id} (${e?.message || e}).` };
        }
      }
      default:
        return null;
    }
  } catch (e) {
    return { raw: `Sorry, I couldn't process that (${e?.message || e}).`, data: { error: e?.message || String(e) } };
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
    "search properties <name/address>",
    "overdue charges",
    "how many overdue charges",
    "how many charges are due soon",
    "how many outstanding charges",
    "how many properties exist",
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
  const wantsPayments = /\bpayments?\b|\binvoices?\b|\bbills?\b|\bpaid\b/.test(lc); // do not match 'unpaid'
  // More specific document intent variants (lease contract / invoice file) before generic handlers
  const wantsLeaseContract = /\blease\s+(contract|agreement)\b/.test(lc) || /\brent\s+agreement\b/.test(lc);
  // Broader invoice document intent – treat simple 'invoice' requests as wanting the actual invoice file if no status word (paid/pending/overdue)
  const invoiceWord = /\binvoice\b/.test(lc);
  const wantsInvoiceDoc = invoiceWord && !/\b(paid|pending|overdue|payments?)\b/.test(lc);
  const wantsFaqs = /\bfaqs?\b|help articles|common questions/.test(lc);
  const wantsTickets = /\btickets?\b|maintenance|repair request/.test(lc);
  const wantsCreateTicket = /create .*ticket|open .*ticket/.test(lc);
  const wantsCharges = /\bcharges?\b|\bbalance\b|\bdue(\s|$)|\boverdue\b|\bunpaid\b/.test(lc);
  const wantsDocuments = /\b(documents?|files?|photos?|images?|attachments?)\b/.test(lc);
  const wantsTenantId = /(tenant\s*id|id\s*card|my\s*id|government\s*id|identification)/i.test(lc);
  const wantsCompany = /company info|contact|support|phone|email|address/.test(lc);
  const wantsAvailableProps = /(available properties|vacant|list properties|show available properties|list available properties)/i.test(lc);
  const wantsListPropertiesGeneric = /(list( down)?|show|display)\s+(all\s+)?properties/i.test(lc);
  const wantsAbout = /\babout\s+us\b|our\s+story|mission|vision/.test(lc);
  const wantsInvoice = /^invoice\s+([a-z0-9-]+)/i.exec(text || "");
  const adminReportFinancial = /report\s+financial/i.test(lc);
  const adminReportTenants = /report\s+tenants?/i.test(lc);
  const adminReportProperties = /report\s+(properties|leases?)/i.test(lc);
  const adminReportMaintenance = /report\s+maintenance|report\s+tickets/i.test(lc);
  // Admin intents
  const adminSearchTenants = /^(search|find)\s+tenants?\s+(.+)/i.exec(text || "");
  const adminTenantInfo = /(?:search|find|show|lookup)\s+tenant\s+(.+?)\s*(?:'s\s*)?(phone|email|contact|number|details)?$/i.exec(text || "");
  const adminOutstandingTenantCharges = /(who\s+are\s+the\s+tenants|which\s+tenants|tenants?)\s+(with\s+)?(outstanding|unpaid|overdue)\s+charges/i.test(lc) || /who\s+owes|which\s+tenants\s+owe/i.test(lc);
  const adminOverdueCharges = /overdue\s+charges?/i.test(lc);
  const adminDueSoonCharges = /due\s+soon\s+charges?/i.test(lc);
  const adminPendingPayments = /pending\s+payments?/i.test(lc);
  const adminListTenants = /^list\s+tenants?(?:\s+status\s*:\s*(active|inactive|all))?/i.exec(text || "");
  const adminCountTenants = /(how\s+many|count)\s+tenants?(\s+are\s+there)?/i.exec(lc);
  const adminListUnpaidCharges = /(list|show|display)\s+unpaid\s+charges?/i.test(lc);
  const adminCountOverdueCharges = /(how\s+many|count)\s+(overdue)\s+charges?/i.test(lc);
  const adminCountDueSoonCharges = /(how\s+many|count)\s+(due\s*soon)\s+charges?/i.test(lc);
  const adminCountOutstandingCharges = /(how\s+many|count)\s+(outstanding|unpaid)\s+charges?/i.test(lc);
  const countAvailablePropsMatch = /(how\s+many|count).*(available)\s+properties(?:\s+in\s+([a-z\s]+))?/i.exec(lc) || /(how\s+many|count)\s+properties\s+are\s+available(?:\s+in\s+([a-z\s]+))?/i.exec(lc);
  const countAllPropsMatch = /(how\s+many|count).*(total\s+)?properties(\s+exist)?\??$/i.exec(lc);
  const adminSearchProperties = /^(search|find)\s+propert(?:y|ies)\s+(.+)/i.exec(text || "");
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

  // --- Targeted: Lease contract documents (tenant/admin) ---
  if (wantsLeaseContract) {
    try {
      const leases = await leaseServices.getLeaseByUserId(String(userId));
      const list = Array.isArray(leases) ? leases : [];
      if (!list.length) return "I couldn't find a lease for you.";
      // Attempt fuzzy match if user referenced a specific property after 'for'
      let targetLease = null;
      const propPhraseMatch = lc.match(/for\s+(?:the\s+)?(.+)$/);
      if (propPhraseMatch) {
        const phrase = propPhraseMatch[1].trim();
        // Simple scoring: include substring match ignoring punctuation
        const normPhrase = phrase.replace(/[^a-z0-9\s]/g,'').toLowerCase();
        const scored = list.map(l => {
          const name = (l.property_name || '').toLowerCase();
          const score = name.includes(normPhrase) ? normPhrase.length : 0;
          return { lease: l, score };
        }).filter(r => r.score > 0).sort((a,b) => b.score - a.score);
        if (scored.length) targetLease = scored[0].lease;
      }
      if (!targetLease) {
        // Fallback: pick active or first
        targetLease = list.find(l => String(l.lease_status).toUpperCase() === 'ACTIVE')
          || list.find(l => String(l.lease_status).toUpperCase() === 'PENDING')
          || list[0];
      }
      if (!targetLease) return "I couldn't find a lease for you.";
      const leaseId = targetLease.lease_id || targetLease.id || null;
      if (!leaseId) {
        return "I found your lease but couldn't locate its contract document (missing lease ID).";
      }
      // Fetch full lease to get contract info (DB-backed)
      const full = await leaseServices.getSingleLeaseById(String(leaseId));
      const url = full && full.contract && full.contract.url ? full.contract.url : null;
      if (!url) {
        return `I didn't find a stored contract file for this lease. You can attach it via Admin > Leases or upload to your lease.`;
      }
      return `Lease contract: ${url}`;
    } catch (e) {
      return `Sorry, I couldn't load the lease contract (${e?.message || e}).`;
    }
  }

  // --- Tenant ID files (from usersServices.tenant_id_files) ---
  if (!isAdminLike(role) && wantsTenantId) {
    try {
      const u = await usersServices.getSingleUserById(String(userId));
      const files = Array.isArray(u?.tenant_id_files) ? u.tenant_id_files : [];
      const urls = files.map(f => f.id_url).filter(Boolean);
      if (!urls.length) return "I couldn't find any ID files on your profile.";
      const lines = urls.slice(0, 8).map(url => `• ${url}`);
      const suffix = urls.length > 8 ? `\n…and ${urls.length - 8} more.` : '';
      return `Your ID files:\n${lines.join('\n')}${suffix}`;
    } catch (e) {
      return `Sorry, I couldn't load your ID files (${e?.message || e}).`;
    }
  }

  // --- Targeted: Invoice document retrieval (tenant/admin) ---
  if (wantsInvoiceDoc) {
    try {
      // Try to extract an explicit ID if provided (e.g., invoice 123, payment abc)
      const idMatch = lc.match(/(?:invoice|payment)\s+([a-z0-9-]+)/i);
      let paymentId = idMatch ? idMatch[1] : null;
      if (!paymentId) {
        // Fallback: latest payment for user (or system if admin)
        if (isAdminLike(role)) {
          const all = await paymentsServices.getAllPayments({ page:1, limit:5 });
          const rows = Array.isArray(all?.rows) ? all.rows : [];
          if (rows.length) paymentId = rows[0].payment_id || rows[0].id;
        } else {
          const mine = await paymentsServices.getPaymentsByUserId(String(userId), { page:1, limit:5 });
          const rows = Array.isArray(mine?.rows) ? mine.rows : [];
          if (rows.length) paymentId = rows[0].payment_id || rows[0].id;
        }
      }
      if (!paymentId) return "I couldn't find a payment to locate an invoice document. Try specifying an invoice or payment id (e.g., 'invoice ABC123').";
      // Use DB-backed invoice lookup and surface a summary + reference
      const invSvc = (await import('./invoicesServices.js'));
      const data = await invSvc.getInvoiceByPaymentId(paymentId);
      if (!data) return `No invoice found for payment ${paymentId}.`;
      const parts = [];
      if (data.invoice?.id) parts.push(`Invoice: ${data.invoice.id} (${data.invoice.status || 'status?'})`);
      if (data.invoice?.issueDate) parts.push(`Issued: ${new Date(data.invoice.issueDate).toLocaleDateString()}`);
      if (data.payment?.id) parts.push(`Payment: ${data.payment.id} — ${data.payment.method || ''} on ${new Date(data.payment.date||Date.now()).toLocaleDateString()}`);
      if (data.payment?.reference) parts.push(`Reference: ${data.payment.reference}`);
      if (data.tenant?.name) parts.push(`Tenant: ${data.tenant.name}`);
      if (data.lease?.id) parts.push(`Lease: ${data.lease.id}`);
      if (data.property?.name) parts.push(`Property: ${data.property.name}${data.property.address?` — ${data.property.address}`:''}`);
      if (Array.isArray(data.items) && data.items.length) {
        parts.push('Items:');
        parts.push(...data.items.map(it => `• ${it.description || it.type || 'Item'} — ${it.amount}`));
      }
      if (data.charge) {
        const c = data.charge;
        parts.push('Charge:');
        if (c.description) parts.push(`• ${c.description}`);
        if (c.dueDate) parts.push(`• Due: ${new Date(c.dueDate).toLocaleDateString()}`);
        if (c.originalAmount !== null && c.originalAmount !== undefined) parts.push(`• Original: ${c.originalAmount}`);
        if (c.lateFee) parts.push(`• Late fee: ${c.lateFee}`);
        if (c.amount !== null && c.amount !== undefined) parts.push(`• Current: ${c.amount}`);
      }
      if (data.invoice?.total !== undefined) parts.push(`Total: ${data.invoice.total}`);
      return parts.join('\n');
    } catch (e) {
      return `Sorry, I couldn't load the invoice files (${e?.message || e}).`;
    }
  }

  // Admin-only handlers FIRST so admin phrases like "overdue" don't fall into tenant flows
  if (isAdminLike(role)) {
    if (adminListTenants) {
      try {
        const raw = adminListTenants[1];
        const status = raw ? raw.replace(/[_\s-]+/g,'_').toUpperCase() : undefined;
        const res = await usersServices.getUsers({ status: status && status !== 'ALL' ? status : undefined, page: 1, limit: 10 });
        const users = Array.isArray(res?.users) ? res.users : [];
        if (!users.length) return "No tenants found.";
        const lines = users.slice(0,10).map(u => `• ${u.first_name || ''} ${u.last_name || ''} — ${u.email || ''}`.trim());
        const total = res?.pagination?.totalUsers || users.length;
        const suffix = total > users.length ? `\n…and ${total - users.length} more.` : '';
        return `Tenants${status?` [${status}]`:''}:\n${lines.join('\n')}${suffix}`;
      } catch (e) { return `Failed to list tenants (${e?.message || e}).`; }
    }
    if (adminCountTenants) {
      try {
        const res = await usersServices.getUsers({ page: 1, limit: 1 });
        const total = Number(res?.pagination?.totalUsers || 0);
        return `${total} tenant${total === 1 ? '' : 's'}.`;
      } catch (e) { return `Failed to count tenants (${e?.message || e}).`; }
    }
    if (adminListUnpaidCharges) {
      try {
        const res = await chargesServices.getAllCharges({ status: 'UNPAID', limit: 5, page: 1 });
        const rows = Array.isArray(res?.data) ? res.data : [];
        if (!rows.length) return "No unpaid charges right now.";
        const lines = rows.slice(0, 5).map(c => `• ${c.tenant_name || 'Tenant'} — ${c.description || c.charge_type || 'Charge'} ${c.amount} (due ${new Date(c.due_date || c.charge_date || Date.now()).toLocaleDateString()})`);
        return `Unpaid charges:\n${lines.join('\n')}`;
      } catch (e) { return `Failed to list unpaid charges (${e?.message || e}).`; }
    }
    if (adminSearchProperties) {
      try {
        const query = adminSearchProperties[2].trim();
        const res = await propertiesServices.getProperties({ limit: 200, page: 1 });
        const all = Array.isArray(res?.properties) ? res.properties : [];
        if (!all.length) return "There are no properties in the system yet.";
        const matches = gemini.fuzzyFilterProperties(query, all, { threshold: 0.5, limit: 5 });
        if (matches.length === 0) return `No properties matched "${query}".`;
        if (matches.length === 1) {
          const p = matches[0].property;
          const parts = [p.property_name, p.city, p.base_rent ? `₱${p.base_rent}` : null].filter(Boolean).join(' — ');
          return `Found: ${parts}`;
        }
        const amb = { status: 'ambiguous', choices: matches };
        return gemini.generatePropertyDisambiguationMessage(amb) || `Multiple properties matched "${query}".`;
      } catch (e) {
        return `Search failed (${e?.message || e}).`;
      }
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
    if (adminTenantInfo) {
      try {
        const nameQuery = adminTenantInfo[1].trim();
        const fieldReq = (adminTenantInfo[2] || '').toLowerCase();
        const res = await usersServices.getUsers({ search: nameQuery, limit: 50, page: 1 });
        const users = Array.isArray(res?.users) ? res.users : [];
        if (!users.length) return `No tenant matched "${nameQuery}".`;
        const fuzzy = gemini.fuzzyFilterTenants(nameQuery, users, { threshold: 0.4, limit: 5 });
        if (!fuzzy.length) return `No tenant matched "${nameQuery}".`;
        if (fuzzy.length > 1) {
          return gemini.generateDisambiguationMessage({ status: 'ambiguous', choices: fuzzy }) || `Multiple tenants matched "${nameQuery}".`;
        }
        const t = fuzzy[0].tenant;
        const profile = {
          name: [t.first_name, t.middle_name, t.last_name].filter(Boolean).join(' '),
          email: t.email,
          phone: t.phone_number,
          status: t.status
        };
        let out = `Tenant: ${profile.name}`;
        if (fieldReq) {
          if (/phone|number/.test(fieldReq) && profile.phone) out += `\nPhone: ${profile.phone}`;
          if (/email|contact/.test(fieldReq) && profile.email) out += `\nEmail: ${profile.email}`;
          if (/details/.test(fieldReq)) {
            out += `${profile.email?`\nEmail: ${profile.email}`:''}${profile.phone?`\nPhone: ${profile.phone}`:''}${profile.status?`\nStatus: ${profile.status}`:''}`;
          }
        } else {
          out += `${profile.email?`\nEmail: ${profile.email}`:''}${profile.phone?`\nPhone: ${profile.phone}`:''}`;
        }
        return out.trim();
      } catch (e) {
        return `Lookup failed (${e?.message || e}).`;
      }
    }
    if (adminOutstandingTenantCharges) {
      try {
        const overdue = await chargesServices.getAllCharges({ status: 'OVERDUE', limit: 500, page: 1 });
        const unpaid = await chargesServices.getAllCharges({ status: 'UNPAID', limit: 500, page: 1 });
        const rows = [...(Array.isArray(overdue?.data)?overdue.data:[]), ...(Array.isArray(unpaid?.data)?unpaid.data:[])];
        if (!rows.length) return "No tenants have outstanding charges right now.";
        const agg = {};
        rows.forEach(r => {
          const key = r.tenant_name || r.tenant_id || 'Tenant';
          if (!agg[key]) agg[key] = { total: 0, count: 0 };
          agg[key].total += Number(r.amount || r.original_amount || 0);
          agg[key].count += 1;
        });
        const entries = Object.entries(agg).sort((a,b) => b[1].total - a[1].total).slice(0,15);
        const lines = entries.map(([n,i]) => `${n}: ₱${i.total.toLocaleString()} (${i.count})`);
        return `Outstanding charges by tenant:\n${lines.join('\n')}`;
      } catch (e) {
        return `Failed to aggregate outstanding charges (${e?.message || e}).`;
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

  if (wantsDocuments) {
    try {
      // Disambiguate context: if user mentions lease, ticket, invoice/payment
      if (/lease/.test(lc)) {
        const idMatch = lc.match(/lease\s+([a-z0-9-]+)/i);
        const lease_id = idMatch ? idMatch[1] : undefined;
        if (lease_id) {
          try {
            const full = await leaseServices.getSingleLeaseById(String(lease_id));
            const url = full && full.contract && full.contract.url ? full.contract.url : null;
            return url ? `Lease ${lease_id} contract: ${url}` : `No contract file stored for lease ${lease_id}.`;
          } catch (e) { return `Failed to load lease ${lease_id} (${e?.message || e}).`; }
        } else {
          const leases = await leaseServices.getLeaseByUserId(String(userId));
          if (!Array.isArray(leases) || !leases.length) return `No lease documents found.`;
          const lines = [];
          for (const l of leases.slice(0, 10)){
            let contractUrl = null;
            try {
              const full = await leaseServices.getSingleLeaseById(String(l.lease_id));
              contractUrl = full && full.contract && full.contract.url ? full.contract.url : null;
            } catch {}
            lines.push(`• ${l.property_name || 'Property'} — ${l.lease_id}: ${contractUrl || '(no contract)'}`);
          }
          const suffix = leases.length > 10 ? `\n…and ${leases.length - 10} more.` : '';
          return `Leases & contracts:\n${lines.join('\n')}${suffix}`;
        }
      }
      if (/ticket/.test(lc)) {
        const idMatch = lc.match(/ticket\s+([a-z0-9-]+)/i);
        const ticket_id = idMatch ? idMatch[1] : undefined;
        if (!ticket_id) return "Provide a ticket id after 'ticket'.";
        try {
          const t = await ticketsServices.getSingleTicketById(ticket_id);
          const atts = Array.isArray(t?.ticket?.attachments) ? t.ticket.attachments : [];
          if (!atts.length) return `No attachments for ticket ${ticket_id}.`;
          const lines = atts.slice(0, 12).map(u => `• ${u}`);
          const suffix = atts.length > 12 ? `\n…and ${atts.length - 12} more.` : '';
          return `Ticket ${ticket_id} attachments:\n${lines.join('\n')}${suffix}`;
        } catch (e) {
          return `Failed to load ticket ${ticket_id} (${e?.message || e}).`;
        }
      }
      if (/invoice|payment/.test(lc)) {
        const idMatch = lc.match(/(?:invoice|payment)\s+([a-z0-9-]+)/i);
        const payment_id = idMatch ? idMatch[1] : undefined;
        if (!payment_id) return "Provide an invoice or payment id.";
        try {
          const invSvc = (await import('./invoicesServices.js'));
          const data = await invSvc.getInvoiceByPaymentId(payment_id);
          if (!data) return `No invoice found for payment ${payment_id}.`;
          const parts = [];
          if (data.invoice?.id) parts.push(`Invoice: ${data.invoice.id} (${data.invoice.status || 'status?'})`);
          if (data.invoice?.issueDate) parts.push(`Issued: ${new Date(data.invoice.issueDate).toLocaleDateString()}`);
          if (data.payment?.id) parts.push(`Payment: ${data.payment.id} — ${data.payment.method || ''} on ${new Date(data.payment.date||Date.now()).toLocaleDateString()}`);
          if (data.payment?.reference) parts.push(`Reference: ${data.payment.reference}`);
          if (data.tenant?.name) parts.push(`Tenant: ${data.tenant.name}`);
          if (data.lease?.id) parts.push(`Lease: ${data.lease.id}`);
          if (data.property?.name) parts.push(`Property: ${data.property.name}${data.property.address?` — ${data.property.address}`:''}`);
          if (Array.isArray(data.items) && data.items.length) {
            parts.push('Items:');
            parts.push(...data.items.map(it => `• ${it.description || it.type || 'Item'} — ${it.amount}`));
          }
          if (data.charge) {
            const c = data.charge;
            parts.push('Charge:');
            if (c.description) parts.push(`• ${c.description}`);
            if (c.dueDate) parts.push(`• Due: ${new Date(c.dueDate).toLocaleDateString()}`);
            if (c.originalAmount !== null && c.originalAmount !== undefined) parts.push(`• Original: ${c.originalAmount}`);
            if (c.lateFee) parts.push(`• Late fee: ${c.lateFee}`);
            if (c.amount !== null && c.amount !== undefined) parts.push(`• Current: ${c.amount}`);
          }
          if (data.invoice?.total !== undefined) parts.push(`Total: ${data.invoice.total}`);
          return parts.join('\n');
        } catch (e) {
          return `Failed to load invoice/payment ${payment_id} (${e?.message || e}).`;
        }
      }
      // Default user documents or admin system-wide
      // If nothing matched, provide guidance based on DB-backed locations
      return isAdminLike(role)
        ? "Try: 'show invoice <paymentId>' or 'show ticket <ticketId> attachments' or 'show lease <leaseId> contract'."
        : "Try: 'invoice 123', 'ticket 123 attachments', or 'lease contract'.";
    } catch (e) {
      return `Sorry, I couldn't list documents (${e?.message || e}).`;
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

  if (wantsAvailableProps || wantsListPropertiesGeneric) {
    try {
      const cityMatch = lc.match(/\b(?:in|at)\s+([a-z\s]+)$/i);
      const rangeMatch = lc.match(/(?:between|from)\s+([\d,.]+)\s*(?:to|and)\s*([\d,.]+)/i);
      const q = { limit: 5, page: 1 };
      if (wantsAvailableProps) q.property_status = 'Available';
      if (cityMatch && cityMatch[1]) q.city = cityMatch[1].trim().replace(/\s+/g,' ');
      if (rangeMatch) {
        const min = Number(String(rangeMatch[1]).replace(/[,]/g,''));
        const max = Number(String(rangeMatch[2]).replace(/[,]/g,''));
        if (!isNaN(min)) q.min_rent = min;
        if (!isNaN(max)) q.max_rent = max;
      }
      const res = await propertiesServices.getProperties(q);
      const props = Array.isArray(res?.properties) ? res.properties : [];
      if (!props.length) return wantsAvailableProps ? "No available properties found right now." : "No properties found right now.";
      const lines = props.map(p => `• ${p.property_name}${p.city ? ` — ${p.city}` : ''}${p.base_rent ? ` (₱${p.base_rent})` : ''}`);
      const truncated = (typeof res.total === 'number' && res.total > props.length);
      const suffix = truncated ? `\n…and ${res.total - props.length} more.` : '';
      const head = wantsAvailableProps ? `Available properties${q.city ? ` in ${q.city}` : ''}` : `Properties${q.city ? ` in ${q.city}` : ''}`;
      const rawText = `${head}${(q.min_rent||q.max_rent)?' (filtered)':''}:\n${lines.join('\n')}${suffix}`;
      if (truncated) {
        return { raw: rawText, meta: { followup: 'expand-list', target: 'properties', params: q } };
      }
      return rawText;
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

  if (isAdminLike(role) && countAllPropsMatch) {
    try {
      const res = await propertiesServices.getProperties({ limit: 1, page: 1 });
      const total = Number(res?.total || 0);
      return `${total} propert${total === 1 ? 'y' : 'ies'} in the system.`;
    } catch (e) {
      return `Sorry, I couldn't count properties (${e?.message || e}).`;
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

  // Check recent bot message for pending expand-list follow-up
  const recent = await assistantMessages.listMessages(convId, 10);
  const lastBot = Array.isArray(recent) ? [...recent].reverse().find(m => m?.direction === 'incoming' && m?.metadata?.sender === 'bot') : null;
  const lastCtx = lastBot?.metadata?.context || lastBot?.metadata?.meta || null;
  const lc = String(text || '').toLowerCase();
  const isAffirmative = /\b(yes|yep|yeah|please)\b/i.test(text || '')
    || /(show|give|provide)\s+.*\b(all|complete|full)\s+list\b/i.test(lc)
    || /\bshow\s+all\b/i.test(lc)
    || /\bcomplete\s+list\b/i.test(lc)
    || /\beverything\b/i.test(lc)
    || /\ball\s+of\s+them\b/i.test(lc);

  // Numeric selection for disambiguation (e.g., "2", "2.", "2)", or words like "two")
  function parseDisambigSelection(raw){
    const s = String(raw||'').trim().toLowerCase();
    if (!s) return null;
    const m = /^\s*(\d{1,2})\s*(?:[\.).])?\s*$/.exec(s);
    if (m) return Number(m[1]);
    const words = {
      one:1, two:2, three:3, four:4, five:5,
      six:6, seven:7, eight:8, nine:9, ten:10
    };
    const w = s.replace(/[^a-z]/g,'');
    if (words[w]) return words[w];
    const m2 = /(?:option|number)\s+(\d{1,2})\b/.exec(s);
    if (m2) return Number(m2[1]);
    return null;
  }
  const numericSelection = parseDisambigSelection(text);

  async function expandFollowUp(meta) {
    if (!meta || meta.followup !== 'expand-list') return null;
    try {
      if (meta.target === 'properties') {
        const q = { ...(meta.params || {}), limit: 500, page: 1 };
        const res = await propertiesServices.getProperties(q);
        const props = Array.isArray(res?.properties) ? res.properties : [];
        const context = { intent: 'list_properties', detail_level: 'full', data: props };
        const phrased = await gemini.generateText({ text: 'Provide the complete list of properties for the user request.', context, system: gemini.getSystemResponsePrompt() });
        return { text: phrased || (props.map(p => `• ${p.property_name}${p.city?` — ${p.city}`:''}${p.base_rent?` (₱${p.base_rent})`:''}`).join('\n') || 'No properties found.'), meta: null };
      }
      if (meta.target === 'tenants') {
        const status = meta.params?.status;
        const res = await usersServices.getUsers({ status: status && status !== 'ALL' ? status : undefined, page: 1, limit: 500 });
        const users = Array.isArray(res?.users) ? res.users : [];
        const context = { intent: 'list_tenants', detail_level: 'full', data: users };
        const phrased = await gemini.generateText({ text: 'Provide the complete list of tenants for the admin request.', context, system: gemini.getSystemResponsePrompt() });
        return { text: phrased || (users.map(u => `• ${u.first_name || ''} ${u.last_name || ''}`.trim()).filter(Boolean).join('\n') || 'No tenants found.'), meta: null };
      }
      if (meta.target === 'tenant-charges') {
        const overdue = await chargesServices.getAllCharges({ status: 'OVERDUE', limit: 2000, page: 1 });
        const unpaid = await chargesServices.getAllCharges({ status: 'UNPAID', limit: 2000, page: 1 });
        const rows = [...(Array.isArray(overdue?.data)?overdue.data:[]), ...(Array.isArray(unpaid?.data)?unpaid.data:[])];
        const agg = {};
        rows.forEach(r => {
          const key = r.tenant_name || r.tenant_id || 'Tenant';
          if (!agg[key]) agg[key] = { total: 0, count: 0 };
          agg[key].total += Number(r.amount || r.original_amount || 0);
          agg[key].count += 1;
        });
        const list = Object.entries(agg).sort((a,b) => b[1].total - a[1].total).map(([n,i]) => ({ name: n, total: i.total, count: i.count }));
        const context = { intent: 'list_tenants_outstanding_charges', detail_level: 'full', data: list };
        const phrased = await gemini.generateText({ text: 'Provide the complete list of tenants and their outstanding charges.', context, system: gemini.getSystemResponsePrompt() });
        return { text: phrased || (list.map(it => `${it.name}: ₱${it.total.toLocaleString()} (${it.count})`).join('\n') || 'No outstanding charges.'), meta: null };
      }
    } catch (e) {
      return { text: `Sorry, I couldn't complete that (${e?.message || e}).` };
    }
    return null;
  }

  // Prefer precise local intents first; then use Gemini as fallback
  let usedGemini = false;
  let reply = null;
  if (isAffirmative && lastCtx && lastCtx.followup === 'expand-list') {
    reply = await expandFollowUp(lastCtx);
    usedGemini = Boolean(reply?.text);
  }
  // Handle disambiguation numeric reply
  if (!reply && numericSelection && lastCtx && lastCtx.followup === 'disambiguate' && Array.isArray(lastCtx.choices)) {
    const index = Number(numericSelection);
    const choice = lastCtx.choices.find(c => c.index === index);
    if (choice) {
      try {
        if (lastCtx.target === 'tenant') {
          const tenant = await usersServices.getSingleUserById(String(choice.id));
          if (tenant) {
            const profile = {
              name: [tenant.first_name, tenant.middle_name, tenant.last_name].filter(Boolean).join(' '),
              email: tenant.email,
              phone: tenant.phone_number,
              status: tenant.status,
            };
            const lines = Object.entries(profile).filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`);
            const suggest = `\n\nNext: reply with 'outstanding charges', 'payments', or 'lease' for this tenant.`;
            reply = { text: `Tenant: ${profile.name}\n${lines.join('\n')}${suggest}` };
          }
        } else if (lastCtx.target === 'property') {
          const propRes = await propertiesServices.getProperties({ limit: 1, page: 1, property_id: choice.id });
          const found = Array.isArray(propRes?.properties) ? propRes.properties[0] : null;
          if (found) {
            const parts = [found.property_name, found.city, found.base_rent?`₱${found.base_rent}`:null].filter(Boolean).join(' — ');
            const suggest = `\n\nNext: reply 'available units' or 'contact info' for this property.`;
            reply = { text: `Property: ${parts}${suggest}` };
          }
        }
      } catch (e) {
        reply = { text: `Sorry, I couldn't load that selection (${e?.message || e}).` };
      }
    } else {
      // Out-of-range selection -> gentle nudge without losing context
      reply = { text: `Please choose a valid number from the list (1-${lastCtx.choices.length}).` , meta: lastCtx };
    }
  }
  if (!reply) {
    reply = await routeLocalIntent(userId, text, role);
  }
  if (!reply) {
    const context = { hints: ["profile", "lease", "payments", "properties", "counts"], userId: String(userId) };
    reply = await tryGeminiReply(text, context, role);
    usedGemini = Boolean(reply);
  }
  // Optional: always have Gemini polish the phrasing, even for local data replies
  const wantPolish = String(process.env.ASSISTANT_POLISH_WITH_GEMINI || 'true').toLowerCase() === 'true';
  if (reply && !usedGemini && wantPolish && gemini.isConfigured()) {
    try {
      const rawText = typeof reply === 'object' && reply !== null ? reply.text || reply.raw : reply;
      const phrased = await gemini.generateText({ text: text, context: { raw_reply: rawText, role: role || 'TENANT' }, system: gemini.getSystemResponsePrompt() });
      if (phrased) { reply = { text: phrased, meta: (reply && typeof reply === 'object') ? reply.meta : null }; usedGemini = true; }
    } catch {}
  }

  // Final fallback
  if (!reply) {
    reply = isAdminLike(role)
      ? "Try: 'show my profile' or 'show my payments [paid|pending|overdue|all]'. For tenant/property actions, use the admin pages."
      : "I can help with: 'show my profile', 'show my lease', or 'show my payments [paid|pending|overdue|all]'.";
  }

  // Record assistant reply (incoming)
  const tag = usedGemini && String(process.env.ASSISTANT_SHOW_MODEL_TAG || '').toLowerCase() === 'true' ? ' · via Gemini' : '';
  const finalText = (typeof reply === 'object' && reply !== null ? (reply.text || reply.raw) : reply) + tag;
  if (usedGemini && process.env.NODE_ENV !== 'production') {
    console.info(`[localAssistant] Gemini used for conversation ${convId}`);
  }
  await pushMessage(convId, {
    direction: "incoming",
    metadata: { sender: "bot", direction: "incoming", context: (typeof reply === 'object' && reply !== null) ? (reply.meta || null) : null },
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
