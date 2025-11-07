// Enhanced legacy widget with linkified URLs + inline viewer overlay.
(function () {
  var API_BASE = window.API_BASE || location.origin + '/api';
  var API_VERSION = window.API_VERSION || 'v1';
  var base = API_BASE.replace(/\/$/,'') + '/' + API_VERSION;
  var state = { conversationId:null, isOpen:false, polling:false, lastRenderCount:0, offline:false };

  function el(tag, attrs, children){ var e=document.createElement(tag); if(attrs) Object.keys(attrs).forEach(function(k){ if(k==='class') e.className=attrs[k]; else if(k==='html') e.innerHTML=attrs[k]; else e.setAttribute(k, attrs[k]); }); if(children) children.forEach(function(c){ if(c) e.appendChild(c); }); return e; }
  function fmtTime(dt){ try { var d=new Date(dt); return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); } catch { return ''; } }
  function isOutgoingMessage(msg){ if(!msg) return false; var meta=(msg.metadata&&typeof msg.metadata==='object')?msg.metadata:{}; var sender=String(meta.sender||'').toLowerCase(); if(sender==='user') return true; if(sender==='bot') return false; if(meta.userKey) return true; var direction=String(msg.direction||meta.direction||'').toLowerCase(); return direction==='outgoing'; }

  // Rich formatter with URL linkification + view buttons
  function richFormat(text){ if(!text) return ''; var escape=function(s){return String(s||'').replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c];});}; var lines=String(text).split(/\r?\n/); var blocks=[], listBuffer=[]; function flushList(){ if(!listBuffer.length) return; blocks.push('<ul class="aac-list">'+listBuffer.map(function(li){return '<li>'+li+'</li>';}).join('')+'</ul>'); listBuffer=[]; } lines.forEach(function(raw){ var line=raw.trimEnd(); if(!line){ flushList(); return; } if(/^[•\-*]\s+/.test(line)){ listBuffer.push(escape(line.replace(/^[•\-*]\s+/,'').trim())); return; } var kv=/^(\w[\w\s/#%&()-]*?):\s*(.+)$/.exec(line); if(kv){ flushList(); blocks.push('<p class="aac-kv"><strong>'+escape(kv[1].trim())+':</strong> '+escape(kv[2].trim())+'</p>'); return; } flushList(); var processed=escape(line); processed=processed.replace(/(https?:\/\/[^\s]+[^\.\s])/g,function(m){ var lower=m.toLowerCase(); var isImage=/(\.png|\.jpe?g|\.webp|\.gif)$/i.test(lower); var isPdf=/\.pdf$/i.test(lower); var viewBtn=(isImage||isPdf)?' <button class="aac-view-btn" data-url="'+m+'" data-type="'+(isPdf?'pdf':'img')+'" type="button">view</button>':''; return '<a href="'+m+'" target="_blank" rel="noopener noreferrer" class="aac-link">'+m+'</a>'+viewBtn; }); blocks.push('<p>'+processed+'</p>'); }); flushList(); return blocks.join(''); }

  function buildUI(){ if(document.getElementById('assistantApiChat')) return; if(document.getElementById('assistantFab')) return; var fab=el('button',{id:'assistantFab',class:'assistant-fab',title:'Chat with Assistant'},[ el('span',{class:'assistant-fab-icon', html:'💬'}) ]); var container=el('div',{id:'assistantChat',class:'assistant-chat hidden'}); var header=el('div',{class:'assistant-chat-header'}); header.appendChild(el('div',{class:'assistant-chat-title', html:'Ambulo Assistant'})); var hdrBtns=el('div',{class:'assistant-chat-hdrbtns'}); var btnAttach=el('button',{class:'assistant-attach',title:'Attachments'},[document.createTextNode('📁')]); var btnMin=el('button',{class:'assistant-minimize',title:'Minimize'},[document.createTextNode('–')]); hdrBtns.appendChild(btnAttach); hdrBtns.appendChild(btnMin); header.appendChild(hdrBtns); var body=el('div',{class:'assistant-chat-body'}); var list=el('div',{id:'assistantChatMessages', class:'assistant-chat-messages'}); body.appendChild(list); var footer=el('div',{class:'assistant-chat-footer'}); var input=el('textarea',{id:'assistantChatInput', class:'assistant-chat-input', rows:'1', placeholder:'Type a message…'}); var send=el('button',{id:'assistantChatSend', class:'assistant-chat-send'},[document.createTextNode('Send')]); footer.appendChild(input); footer.appendChild(send); container.appendChild(header); container.appendChild(body); container.appendChild(footer); document.body.appendChild(fab); document.body.appendChild(container); function open(){ state.isOpen=true; container.classList.remove('hidden'); fab.classList.add('hidden'); ensureConversation(); } function close(){ state.isOpen=false; container.classList.add('hidden'); fab.classList.remove('hidden'); } fab.addEventListener('click', open); btnMin.addEventListener('click', close); btnAttach.addEventListener('click', function(){ alert('Attachments are coming soon.'); }); function autoResize(){ input.style.height='auto'; input.style.height=Math.min(140,input.scrollHeight)+'px'; } input.addEventListener('input', autoResize); autoResize(); function doSend(){ var txt=(input.value||'').trim(); if(!txt) return; input.value=''; autoResize(); sendMessage(txt); } send.addEventListener('click', doSend); input.addEventListener('keydown', function(e){ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); doSend(); } }); }

  async function ensureConversation(){ if(state.conversationId || state.offline) return; try { var res=await fetch(base+'/assistant/chat/open',{method:'POST', credentials:'include'}); if(res.status===501){ renderOffline(); return; } if(!res.ok) throw new Error('open failed'); var data=await res.json(); state.conversationId=data.conversationId; startPolling(); } catch(e){ console.warn('[assistant] open error', e); } }
  function renderOffline(){ state.offline=true; var list=document.getElementById('assistantChatMessages'); if(!list) return; list.innerHTML='<div class="assistant-msg assistant-msg-sys">Assistant is currently offline. Please try again later.</div>'; }
  async function sendMessage(text){ if(!state.conversationId) await ensureConversation(); try { await fetch(base+'/assistant/chat/send',{ method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify({conversationId:state.conversationId, text:text}) }); appendMessage({ direction:'outgoing', createdAt:new Date().toISOString(), payload:{ type:'text', text:text } }); scrollToBottom(); } catch(e){ console.warn('[assistant] send failed', e); } }
  function appendMessage(msg){ var list=document.getElementById('assistantChatMessages'); if(!list || !msg || !msg.payload) return; var isOut=isOutgoingMessage(msg); var text=(msg.payload&&msg.payload.text)||''; var item=el('div',{class:'assistant-msg '+(isOut?'assistant-out':'assistant-in')}); var bubble=el('div',{class:'assistant-bubble'}); bubble.innerHTML=richFormat(text); var meta=el('div',{class:'assistant-meta', html:fmtTime(msg.createdAt)}); item.appendChild(bubble); item.appendChild(meta); list.appendChild(item); }
  function scrollToBottom(){ var list=document.getElementById('assistantChatMessages'); if(!list) return; list.scrollTop=list.scrollHeight; }
  async function pollOnce(){ if(!state.conversationId || state.offline) return; try { var url=base+'/assistant/chat/messages?conversationId='+encodeURIComponent(state.conversationId)+'&limit=50'; var res=await fetch(url,{credentials:'include'}); if(res.status===501){ renderOffline(); return; } if(!res.ok) return; var data=await res.json(); var msgs=Array.isArray(data.messages)?data.messages:[]; var list=document.getElementById('assistantChatMessages'); if(!list) return; if(msgs.length !== state.lastRenderCount){ list.innerHTML=''; msgs.forEach(appendMessage); state.lastRenderCount=msgs.length; scrollToBottom(); } } catch(e){} }
  function startPolling(){ if(state.polling) return; state.polling=true; (function loop(){ if(!state.polling) return; pollOnce().finally(function(){ setTimeout(loop,1500); }); })(); }

  // Viewer overlay (shared with modern widget)
  function openViewer(url,type){ var overlay=document.querySelector('.aac-viewer'); if(!overlay){ overlay=document.createElement('div'); overlay.className='aac-viewer'; overlay.innerHTML='<div class="aac-viewer-inner"><button type="button" class="aac-viewer-close" title="Close">×</button><div class="aac-viewer-content"></div></div>'; document.body.appendChild(overlay); overlay.querySelector('.aac-viewer-close').addEventListener('click', function(){ overlay.remove(); }); } var content=overlay.querySelector('.aac-viewer-content'); content.innerHTML=''; if(type==='pdf'){ var iframe=document.createElement('iframe'); iframe.src=url; iframe.title='Document preview'; iframe.style.width='100%'; iframe.style.height='100%'; iframe.loading='lazy'; content.appendChild(iframe); } else if(type==='img'){ var img=document.createElement('img'); img.src=url; img.alt='Document image'; img.style.maxWidth='100%'; img.style.maxHeight='100%'; content.appendChild(img); } else { var a=document.createElement('a'); a.href=url; a.target='_blank'; a.rel='noopener noreferrer'; a.textContent='Open document'; content.appendChild(a); } overlay.style.display='flex'; }
  document.addEventListener('click', function(e){ var btn=e.target.closest('.aac-view-btn'); if(!btn) return; openViewer(btn.getAttribute('data-url'), btn.getAttribute('data-type')); });
  function injectViewerStyles(){ if(!document.querySelector('link[data-assistant-viewer-style]')){ var link=document.createElement('link'); link.rel='stylesheet'; link.href='/css/assistant-viewer.css'; link.setAttribute('data-assistant-viewer-style','true'); document.head.appendChild(link); } }
  function init(){ buildUI(); injectViewerStyles(); }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
(function(){
  
  if (window.__AssistantApiChatInitialized) return;
  const el = document.getElementById('assistantApiChat');
  if (!el) return; 
  window.__AssistantApiChatInitialized = true;

  const API_BASE = window.API_BASE || `${location.origin}/api`;
  const API_VERSION = window.API_VERSION || 'v1';
  const base = `${API_BASE.replace(/\/$/, '')}/${API_VERSION}/assistant`;

  
  // Inject modern stylesheet if not present
  (function injectStyles(){
    if (!document.querySelector('link[data-assistant-chat-style]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/css/assistant-chat.css';
      link.setAttribute('data-assistant-chat-style','true');
      document.head.appendChild(link);
    }
    if (!document.querySelector('link[data-assistant-viewer-style]')) {
      const link2 = document.createElement('link');
      link2.rel = 'stylesheet';
      link2.href = '/css/assistant-viewer.css';
      link2.setAttribute('data-assistant-viewer-style','true');
      document.head.appendChild(link2);
    }
  })();

  const root = document.createElement('div');
  root.className = 'assistant-api-chat';
  const ui = document.createElement('div');
  ui.className = 'aac-window';
  ui.innerHTML = `
    <div class="aac-header">
      <div class="aac-brand">
        <img src="/assets/logo-property.png" alt="Ambulo Logo" class="aac-logo"/>
        <span class="aac-title">Ambulo Assistant</span>
      </div>
      <div class="aac-actions">
        <button type="button" class="aac-theme" title="Toggle theme">☾</button>
        <button type="button" class="aac-min" title="Minimize">×</button>
      </div>
    </div>
    <div class="aac-body"></div>
    <form class="aac-input" autocomplete="off">
      <textarea name="text" placeholder="Type a message..." rows="1" spellcheck="true"></textarea>
      <button type="submit" class="aac-send" title="Send">↩</button>
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
  const input = form.querySelector('textarea[name="text"]');
  const minBtn = ui.querySelector('.aac-min');
  const themeBtn = ui.querySelector('.aac-theme');

  let conversationId = null;
  let assistantDisabled = false;
  let pollTimer = null;
  let lastMessageCount = 0;
  let isOpen = false; // track window visibility
  let pollIntervalMs = 6000; // default poll interval (6s) to stay under rate limits
  let backoffUntil = 0; // epoch ms until which we should not poll

  async function openConversation(){
    if (conversationId || assistantDisabled) {
      if (conversationId && isOpen) startPolling();
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
  if (isOpen) startPolling();
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
    isOpen = true;
    openConversation().catch(() => {});
    startPolling();
  }
  function hideWindow(){
    ui.style.display = 'none';
    fab.style.display = 'flex';
    isOpen = false;
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
  }

  function startPolling(){
    if (pollTimer || !isOpen || assistantDisabled || !conversationId) return;
    const loop = () => {
      if (!isOpen || assistantDisabled || !conversationId) { pollTimer = null; return; }
      const now = Date.now();
      const wait = Math.max(0, backoffUntil - now);
      if (wait > 0) {
        pollTimer = setTimeout(loop, wait);
        return;
      }
      refresh().finally(() => {
        pollTimer = setTimeout(loop, pollIntervalMs);
      });
    };
    pollTimer = setTimeout(loop, 0);
  }

  function formatPayload(payload){
    if (!payload) return '';
    const candidates = [payload.text, payload.title, payload.description, payload.markdown];
    for (const value of candidates){ if (typeof value === 'string' && value.trim()) return value; }
    if (Array.isArray(payload.choices)) return payload.choices.map(c => String(c.title || c.value || '')).filter(Boolean).join('\n');
    try { return JSON.stringify(payload); } catch { return ''; }
  }

  // Convert plain text into rich HTML (lists, bold keys, preserved breaks) safely
  function richFormat(text){
    if (!text) return '';
    const escape = (s) => String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const lines = text.split(/\r?\n/);
    const blocks = [];
    let listBuffer = [];
    function flushList(){
      if (!listBuffer.length) return;
      blocks.push('<ul class="aac-list">'+listBuffer.map(li=>'<li>'+li+'</li>').join('')+'</ul>');
      listBuffer = [];
    }
    lines.forEach(raw => {
      const line = raw.trimEnd();
      if (!line){ flushList(); return; }
      if (/^[•\-*]\s+/.test(line)){ // bullet
        const item = escape(line.replace(/^[•\-*]\s+/,'').trim());
        listBuffer.push(item);
        return;
      }
      const kv = /^(\w[\w\s/#%&()-]*?):\s*(.+)$/.exec(line);
      if (kv){
        flushList();
        const key = escape(kv[1].trim());
        const val = escape(kv[2].trim());
        blocks.push(`<p class="aac-kv"><strong>${key}:</strong> ${val}</p>`);
        return;
      }
      flushList();
      // Linkify URLs (http/https) and inline view buttons for PDFs/images; proxy Cloudinary for reliable inline view
      let processed = escape(line);
      processed = processed.replace(/(https?:\/\/[^\s]+[^\.\s])/g, (m) => {
        const lower = m.toLowerCase();
        const isImage = /(\.png|\.jpe?g|\.webp|\.gif)$/i.test(lower);
        const isPdf = /\.pdf$/i.test(lower);
        const isCloudinary = /https?:\/\/[^\s]*res\.cloudinary\.com\//i.test(lower);
        const safe = m;
        const proxied = isCloudinary ? `${API_BASE.replace(/\/$/,'')}/${API_VERSION}/assistant/view?url=${encodeURIComponent(safe)}` : safe;
        const viewType = isImage ? 'img' : (isPdf ? 'pdf' : (isCloudinary ? 'pdf' : 'other'));
        const viewBtn = (isImage || isPdf || isCloudinary) ? ` <button class="aac-view-btn" data-url="${proxied}" data-type="${viewType}" type="button">view</button>` : '';
        return `<a href="${proxied}" target="_blank" rel="noopener noreferrer" class="aac-link" data-view-type="${viewType}" data-view-url="${proxied}">${safe}</a>${viewBtn}`;
      });
      blocks.push('<p>'+processed+'</p>');
    });
    flushList();
    return blocks.join('');
  }

  function renderMessages(msgs){
    body.innerHTML = '';
    msgs.forEach(m => {
      const fromBot = classifyMessage(m) === 'bot';
      const raw = formatPayload(m.payload);
      let hasGemini = false;
      let text = raw || '';
      if (/\s*[·•]\s*via\s+Gemini\s*$/i.test(text)) {
        hasGemini = true;
        text = text.replace(/\s*[·•]\s*via\s+Gemini\s*$/i, '').trimEnd();
      }
      const row = document.createElement('div');
      row.className = 'aac-msg ' + (fromBot ? 'bot' : 'user');
      // Alignment: bot left, user right using flex and margin auto
      row.style.justifyContent = fromBot ? 'flex-start' : 'flex-end';

      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      if (fromBot) {
        const img = document.createElement('img');
        img.src = '/assets/logo-property.png';
        img.alt = 'Ambulo';
        img.style.width = '24px';
        img.style.height = '24px';
        img.style.objectFit = 'contain';
        avatar.appendChild(img);
      } else {
        // Use initial of (You) or derive from potential user metadata later
        avatar.textContent = 'Y';
      }

      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.innerHTML = richFormat(text);
      if (fromBot && hasGemini) {
        const tag = document.createElement('span');
        tag.className = 'meta-tag';
        tag.textContent = 'via Gemini';
        bubble.appendChild(document.createElement('br'));
        bubble.appendChild(tag);
      }

      // Order depends on side: bot => avatar left of bubble; user => bubble left of avatar
      if (fromBot) {
        row.appendChild(avatar);
        row.appendChild(bubble);
      } else {
        row.appendChild(bubble);
        row.appendChild(avatar);
      }
      body.appendChild(row);
    });
    body.scrollTop = body.scrollHeight;
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
    if (res.status === 429) {
      // Back off for a short period and slow down polling
      backoffUntil = Date.now() + 15000; // 15s backoff
      pollIntervalMs = Math.min(20000, Math.max(6000, pollIntervalMs * 1.5));
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    const msgs = Array.isArray(data.messages) ? data.messages : [];
    if (msgs.length === lastMessageCount) return;
    lastMessageCount = msgs.length;
    renderMessages(msgs);
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
      input.style.height = '38px';
      // Optimistic render user message right-aligned
      const row = document.createElement('div');
      row.className = 'aac-msg user';
      row.style.justifyContent = 'flex-end';
      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      avatar.textContent = 'Y';
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.innerHTML = richFormat(text);
      row.appendChild(bubble);
      row.appendChild(avatar);
      body.appendChild(row);
      body.scrollTop = body.scrollHeight;
      
      setTimeout(() => refresh().catch(() => {}), 600);
      setTimeout(() => refresh().catch(() => {}), 1600);
    } catch (err) {
      
    }
  });

  // Delegated click for view buttons to open inline viewer overlay
  body.addEventListener('click', (e) => {
    const btn = e.target.closest('.aac-view-btn');
    if (!btn) return;
    const url = btn.getAttribute('data-url');
    const type = btn.getAttribute('data-type');
    if (!url) return;
    openViewer(url, type);
  });

  // Also intercept anchor clicks for links we can preview (image/pdf/cloudinary)
  body.addEventListener('click', (e) => {
    const a = e.target.closest('a.aac-link');
    if (!a) return;
    const type = a.getAttribute('data-view-type');
    const url = a.getAttribute('data-view-url') || a.href;
    if (type && (type === 'img' || type === 'pdf')) {
      e.preventDefault();
      openViewer(url, type);
    }
  });

  function openViewer(url, type){
    let overlay = document.querySelector('.aac-viewer');
    if (!overlay){
      overlay = document.createElement('div');
      overlay.className = 'aac-viewer';
      overlay.innerHTML = '<div class="aac-viewer-inner"><button type="button" class="aac-viewer-close" title="Close">×</button><div class="aac-viewer-content"></div></div>';
      document.body.appendChild(overlay);
      overlay.querySelector('.aac-viewer-close').addEventListener('click', () => overlay.remove());
    }
    const content = overlay.querySelector('.aac-viewer-content');
    content.innerHTML = '';
    if (type === 'pdf') {
      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.setAttribute('title','Document preview');
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.loading = 'lazy';
      content.appendChild(iframe);
    } else if (type === 'img') {
      const img = document.createElement('img');
      img.src = url;
      img.alt = 'Document image';
      img.style.maxWidth = '100%';
      img.style.maxHeight = '100%';
      content.appendChild(img);
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'Open document';
      content.appendChild(a);
    }
    overlay.style.display = 'flex';
  }

  // Enter key sends (already shift+Enter for newline prevented by form submit). Add explicit keydown for clarity.
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  // Auto-resize textarea
  function autoResize(){
    input.style.height = '38px';
    input.style.height = Math.min(160, input.scrollHeight) + 'px';
  }
  input.addEventListener('input', autoResize);
  autoResize();

  // Theme toggle
  themeBtn.addEventListener('click', () => {
    document.documentElement.classList.toggle('assistant-dark');
  });

  minBtn.addEventListener('click', hideWindow);
  fab.addEventListener('click', async () => {
    showWindow();
    await refresh();
  });

  
  hideWindow();
})();
