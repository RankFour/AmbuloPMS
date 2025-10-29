(function () {
  var API_BASE = window.API_BASE || location.origin + "/api";
  var API_VERSION = window.API_VERSION || "v1";
  var base = API_BASE.replace(/\/$/, "") + "/" + API_VERSION;

  var state = {
    conversationId: null,
    isOpen: false,
    polling: false,
    lastRenderCount: 0,
    offline: false,
  };

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") e.className = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    if (children) children.forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }

  function fmtTime(dt) {
    try {
      var d = new Date(dt);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ""; }
  }

  function isOutgoingMessage(msg) {
    if (!msg) return false;
    var meta = (msg.metadata && typeof msg.metadata === 'object') ? msg.metadata : {};
    var sender = String(meta.sender || '').toLowerCase();
    if (sender === 'user') return true;
    if (sender === 'bot') return false;
    if (meta.userKey) return true;
    var direction = String(msg.direction || meta.direction || '').toLowerCase();
    return direction === 'outgoing';
  }

  function buildUI() {
    if (document.getElementById('assistantApiChat')) return;
    if (document.getElementById('assistantFab')) return; 

    var fab = el('button', { id: 'assistantFab', class: 'assistant-fab', title: 'Chat with Assistant' }, [
      el('span', { class: 'assistant-fab-icon', html: '💬' })
    ]);

    var container = el('div', { id: 'assistantChat', class: 'assistant-chat hidden' });
    var header = el('div', { class: 'assistant-chat-header' });
    header.appendChild(el('div', { class: 'assistant-chat-title', html: 'Ambulo Assistant' }));
  var hdrBtns = el('div', { class: 'assistant-chat-hdrbtns' });
  var btnAttach = el('button', { class: 'assistant-attach', title: 'Attachments' }, [document.createTextNode('📁')]);
  var btnMin = el('button', { class: 'assistant-minimize', title: 'Minimize' }, [document.createTextNode('–')]);
  hdrBtns.appendChild(btnAttach);
    hdrBtns.appendChild(btnMin);
    header.appendChild(hdrBtns);

    var body = el('div', { class: 'assistant-chat-body' });
    var list = el('div', { id: 'assistantChatMessages', class: 'assistant-chat-messages' });
    body.appendChild(list);

    var footer = el('div', { class: 'assistant-chat-footer' });
    var input = el('textarea', { id: 'assistantChatInput', class: 'assistant-chat-input', rows: '1', placeholder: 'Type a message…' });
    var send = el('button', { id: 'assistantChatSend', class: 'assistant-chat-send' }, [document.createTextNode('Send')]);
    footer.appendChild(input);
    footer.appendChild(send);

    container.appendChild(header);
    container.appendChild(body);
    container.appendChild(footer);

    document.body.appendChild(fab);
    document.body.appendChild(container);

    function open() { state.isOpen = true; container.classList.remove('hidden'); fab.classList.add('hidden'); ensureConversation(); }
    function close() { state.isOpen = false; container.classList.add('hidden'); fab.classList.remove('hidden'); }

    fab.addEventListener('click', open);
    btnMin.addEventListener('click', close);
    btnAttach.addEventListener('click', function(){
      
      alert('Attachments are coming soon.');
    });

    function autoResize() {
      input.style.height = 'auto';
      input.style.height = Math.min(140, input.scrollHeight) + 'px';
    }
    input.addEventListener('input', autoResize);
    autoResize();

    function doSend() {
      var txt = (input.value || '').trim();
      if (!txt) return;
      input.value = '';
      autoResize();
      sendMessage(txt);
    }
    send.addEventListener('click', doSend);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
    });
  }

  async function ensureConversation() {
    if (state.conversationId || state.offline) return;
    try {
      var res = await fetch(base + '/assistant/chat/open', { method: 'POST', credentials: 'include' });
      if (res.status === 501) { renderOffline(); return; }
      if (!res.ok) throw new Error('open failed');
      var data = await res.json();
      state.conversationId = data.conversationId;
      startPolling();
    } catch (e) { console.warn('[assistant] open error', e); }
  }

  function renderOffline() {
    state.offline = true;
    var list = document.getElementById('assistantChatMessages');
    if (!list) return;
    list.innerHTML = '<div class="assistant-msg assistant-msg-sys">Assistant is currently offline. Please try again later.</div>';
  }

  async function sendMessage(text) {
    if (!state.conversationId) await ensureConversation();
    try {
      await fetch(base + '/assistant/chat/send', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: state.conversationId, text: text })
      });
      
      appendMessage({ direction: 'outgoing', createdAt: new Date().toISOString(), payload: { type: 'text', text: text } });
      scrollToBottom();
    } catch (e) { console.warn('[assistant] send failed', e); }
  }

  function appendMessage(msg) {
    var list = document.getElementById('assistantChatMessages');
    if (!list) return;
    if (!msg || !msg.payload) return;
    var isOut = isOutgoingMessage(msg);
    var text = (msg.payload && msg.payload.text) || '';
    var item = el('div', { class: 'assistant-msg ' + (isOut ? 'assistant-out' : 'assistant-in') });
    var bubble = el('div', { class: 'assistant-bubble' }, [document.createTextNode(text)]);
    var meta = el('div', { class: 'assistant-meta', html: fmtTime(msg.createdAt) });
    item.appendChild(bubble);
    item.appendChild(meta);
    list.appendChild(item);
  }

  function scrollToBottom() {
    var list = document.getElementById('assistantChatMessages');
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }

  async function pollOnce() {
    if (!state.conversationId || state.offline) return;
    try {
      var url = base + '/assistant/chat/messages?conversationId=' + encodeURIComponent(state.conversationId) + '&limit=50';
      var res = await fetch(url, { credentials: 'include' });
      if (res.status === 501) { renderOffline(); return; }
      if (!res.ok) return;
      var data = await res.json();
      var msgs = Array.isArray(data.messages) ? data.messages : [];
      var list = document.getElementById('assistantChatMessages');
      if (!list) return;
      if (msgs.length !== state.lastRenderCount) {
        list.innerHTML = '';
        msgs.forEach(appendMessage);
        state.lastRenderCount = msgs.length;
        scrollToBottom();
      }
    } catch (e) { /* noop */ }
  }

  function startPolling() {
    if (state.polling) return; state.polling = true;
    (function loop() {
      if (!state.polling) return;
      pollOnce().finally(function () {
        setTimeout(loop, 1500);
      });
    })();
  }

  function init() {
    buildUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
(function(){
  
  if (window.__AssistantApiChatInitialized) return;
  const el = document.getElementById('assistantApiChat');
  if (!el) return; 
  window.__AssistantApiChatInitialized = true;

  const API_BASE = window.API_BASE || `${location.origin}/api`;
  const API_VERSION = window.API_VERSION || 'v1';
  const base = `${API_BASE.replace(/\/$/, '')}/${API_VERSION}/assistant`;

  
  const root = document.createElement('div');
  root.className = 'assistant-api-chat';
  const ui = document.createElement('div');
  ui.className = 'aac-window';
  ui.innerHTML = `
    <div class="aac-header">
      <div class="aac-brand">
        <img src="/assets/logo-property.png" alt="Assistant"/>
        <span class="aac-title">Ambulo Assistant</span>
      </div>
      <button type="button" class="aac-min" title="Minimize">_</button>
    </div>
    <div class="aac-body"></div>
    <form class="aac-input">
      <input type="text" name="text" placeholder="Type a message" autocomplete="off"/>
      <button type="submit">Send</button>
    </form>`;

  
  const fab = document.createElement('button');
  fab.className = 'aac-fab';
  fab.setAttribute('aria-label', 'Open assistant chat');
  fab.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http:
      <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"/>
    </svg>`;

  root.appendChild(ui);
  document.body.appendChild(root);
  document.body.appendChild(fab);

  const body = ui.querySelector('.aac-body');
  const form = ui.querySelector('.aac-input');
  const input = form.querySelector('input[name="text"]');
  const minBtn = ui.querySelector('.aac-min');

  let conversationId = null;
  let assistantDisabled = false;
  let pollTimer = null;
  let lastMessageCount = 0;

  async function openConversation(){
    if (conversationId || assistantDisabled) {
      if (conversationId) startPolling();
      return conversationId;
    }
    try {
      const res = await fetch(`${base}/chat/open`, { method:'POST', credentials:'include' });
      if (res.status === 501){
        assistantDisabled = true;
        fab.disabled = true;
        fab.title = 'Assistant is currently offline';
        return;
      }
      if (res.status === 401){
        assistantDisabled = true;
        fab.disabled = true;
        fab.title = 'Assistant identity misconfigured (Invalid user key)';
        return;
      }
      if (!res.ok) throw new Error('open failed');
      const data = await res.json();
      conversationId = data.conversationId;
      lastMessageCount = 0;
      startPolling();
      await refresh();
      return conversationId;
    } catch (e) {
      assistantDisabled = true;
      fab.disabled = true;
      fab.title = 'Assistant unavailable (check configuration)';
      throw e;
    }
  }

  function showWindow(){
    if (assistantDisabled) return;
    ui.style.display = 'flex';
    fab.style.display = 'none';
  }
  function hideWindow(){
    ui.style.display = 'none';
    fab.style.display = 'flex';
  }

  function startPolling(){
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      refresh().catch(() => {});
    }, 2000);
  }

  function formatPayload(payload){
    if (!payload) return '';
    const candidates = [payload.text, payload.title, payload.description, payload.markdown];
    for (const value of candidates){
      if (typeof value === 'string' && value.trim()) return value;
    }
    if (Array.isArray(payload.choices)){
      return payload.choices.map(choice => String(choice.title || choice.value || '')).filter(Boolean).join(', ');
    }
    try {
      return JSON.stringify(payload);
    } catch {
      return '';
    }
  }

  function classifyMessage(message){
    if (!message) return 'bot';
    const meta = (message.metadata && typeof message.metadata === 'object') ? message.metadata : {};
    const sender = String(meta.sender || '').toLowerCase();
    if (sender === 'user') return 'user';
    if (sender === 'bot') return 'bot';
    if (meta.userKey) return 'user';
    const direction = String(message.direction || meta.direction || '').toLowerCase();
    if (direction === 'outgoing') return 'user';
    if (direction === 'incoming') return 'bot';
    if (String(message.userId || '').toLowerCase() === 'bot') return 'bot';
    return 'bot';
  }

  async function refresh(){
    if (!conversationId) return;
    const url = new URL(`${base}/chat/messages`);
    url.searchParams.set('conversationId', conversationId);
    url.searchParams.set('limit', '50');
    const res = await fetch(url.toString(), { credentials:'include' });
    if (!res.ok) return;
    const data = await res.json();
    const msgs = Array.isArray(data.messages) ? data.messages : [];
    if (msgs.length === lastMessageCount) return;
    lastMessageCount = msgs.length;
    body.innerHTML = msgs.map(m => {
      const fromBot = classifyMessage(m) === 'bot';
      const text = formatPayload(m.payload);
        return fromBot
          ? `<div class="aac-msg-bot">${escapeHtml(text)}</div>`
          : `<div class="aac-msg-user">${escapeHtml(text)}</div>`;
    }).join('');
    body.scrollTop = body.scrollHeight;
  }

  function escapeHtml(s){
    return String(s || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = (input.value || '').trim();
    if (!text) return;
    try {
      await fetch(`${base}/chat/send`, {
        method:'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials:'include',
        body: JSON.stringify({ conversationId, text })
      });
      input.value = '';
      
      body.insertAdjacentHTML('beforeend', `<div class="aac-msg-user">${escapeHtml(text)}</div>`);
      body.scrollTop = body.scrollHeight;
      
      setTimeout(() => refresh().catch(() => {}), 600);
      setTimeout(() => refresh().catch(() => {}), 1600);
    } catch (err) {
      
    }
  });

  minBtn.addEventListener('click', hideWindow);
  fab.addEventListener('click', async () => {
    if (!conversationId && !assistantDisabled) await openConversation();
    showWindow();
    await refresh();
  });

  
  hideWindow();
  
  openConversation().catch(() => {});
})();
