(function(){
  const API_BASE = window.API_BASE || `${location.origin}/api`;
  const API_VERSION = window.API_VERSION || 'v1';
  const base = `${API_BASE}/${API_VERSION}/assistant`;

  const el = document.getElementById('assistantApiChat');
  if (!el) return; // no container on this page

  // Mount the assistant at the top-level (body) to avoid stacking-context issues
  const ui = document.createElement('div');
  ui.className = 'assistant-api-chat';
  ui.innerHTML = `
    <div class="aac-window">
      <div class="aac-header">
        <div class="aac-brand">
          <img src="/assets/logo-property.png" alt="Assistant"/>
          <span class="aac-title">Ambulo Assistant</span>
        </div>
        <button type="button" class="aac-min">_</button>
      </div>
      <div class="aac-body"></div>
      <form class="aac-input">
        <input type="text" name="text" placeholder="Type a message"/>
        <button type="submit">Send</button>
      </form>
    </div>`;
  document.body.appendChild(ui);

  // Floating Action Button (collapsed mode)
  const fab = document.createElement('button');
  fab.className = 'aac-fab';
  fab.setAttribute('aria-label', 'Open assistant chat');
  fab.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="white"/>
    </svg>`;
  document.body.appendChild(fab);

  const body = ui.querySelector('.aac-body');
  const form = ui.querySelector('.aac-input');
  const input = form.querySelector('input[name="text"]');
  const minBtn = ui.querySelector('.aac-min');

  let conversationId = null;
  let assistantDisabled = false;
  let isOpen = false;

  const bubbles = {
    user: (t) => `<div class="aac-msg-user">${escapeHtml(t)}</div>`,
    bot: (t) => `<div class="aac-msg-bot">${escapeHtml(t)}</div>`
  };

  function escapeHtml(s){
    return String(s || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  }

  async function openConversation(){
    const res = await fetch(`${base}/chat/open`, { method:'POST', credentials:'include' });
    if (!res.ok){
      if (res.status === 501){
        assistantDisabled = true;
      }
      throw new Error('open failed');
    }
    const data = await res.json();
    conversationId = data.conversationId;
    await refresh();
  }

  function showWindow(){
    if (assistantDisabled){
      // Provide a quick hint if assistant is not configured
      fab.title = 'Assistant is currently offline';
      return;
    }
    ui.querySelector('.aac-window').style.display = 'flex';
    fab.style.display = 'none';
    isOpen = true;
  }

  function hideWindow(){
    ui.querySelector('.aac-window').style.display = 'none';
    fab.style.display = 'flex';
    isOpen = false;
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
    body.innerHTML = msgs.map(m => {
      const isUser = m.userId && String(m.userId) !== 'bot';
      const text = m.payload?.text || m.payload?.title || JSON.stringify(m.payload);
      return isUser ? bubbles.user(text) : bubbles.bot(text);
    }).join('');
    body.scrollTop = body.scrollHeight;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    try {
      await fetch(`${base}/chat/send`, {
        method:'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials:'include',
        body: JSON.stringify({ conversationId, text })
      });
      input.value = '';
      // optimistic render
      body.insertAdjacentHTML('beforeend', bubbles.user(text));
      body.scrollTop = body.scrollHeight;
      // give the bot a moment, then refresh
      setTimeout(refresh, 800);
      setTimeout(refresh, 2000);
    } catch (err) { console.warn('send failed', err); }
  });

  minBtn.addEventListener('click', () => {
    hideWindow();
  });

  fab.addEventListener('click', async () => {
    try {
      if (!conversationId && !assistantDisabled){
        await openConversation();
      }
      showWindow();
    } catch (e) {
      // If failed to open, mark disabled and keep FAB visible
      assistantDisabled = true;
      fab.disabled = true;
      fab.title = 'Assistant is currently offline';
    }
  });
  // Start collapsed as a FAB; lazily open conversation on first click
  hideWindow();
  // Try to warm up conversation in background (non-blocking)
  openConversation().catch((e) => console.warn('assistant chat init failed', e));
})();
