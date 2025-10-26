import { getJwtToken, getCookie } from "../utils/getCookie.js";
import formatTimeFlexible from "../utils/formatTime.js";
import fetchCompanyDetails from "../api/loadCompanyInfo.js";

const announcements = [];

let chatContacts = [];
let allChatContacts = [];
let lastChatSearchQuery = "";
const chatMessagesCache = {};

let currentAnnouncementFilter = "all";
let currentChatContact = null;
let currentPage = 1;
let announcementsPerPage = 6;

let socket = null;
let jwtToken = null;
let currentUser = null;
let typingTimeouts = {};
let chatSearchDebounce = null;
const API_BASE = "/api/v1";
let pendingAttachments = [];
let pendingTmpMap = new Map();

document.addEventListener("DOMContentLoaded", async function () {
  
  try {
    console.debug("messages: DOMContentLoaded - script running");
  } catch (e) {}

  
  try {
    if (typeof getCookie === "function") {
      const t = getCookie("token");
      if (t) jwtToken = t;
    }
  } catch (e) {}

  if (!jwtToken) {
    try {
      
      jwtToken = getJwtToken();
    } catch (e) {
      jwtToken = null;
      console.debug("messages: getJwtToken threw or redirected; proceeding without token");
    }
  }
  try {
    const userStr = localStorage.getItem("user");
    if (userStr) currentUser = JSON.parse(userStr);
  } catch {}

  
  try {
    console.debug("messages:init jwt present:", !!jwtToken);
    console.debug("messages:init currentUser:", currentUser ? { id: currentUser.user_id, role: currentUser.role } : null);
  } catch (e) {}

  renderAnnouncements();
  setupEventListeners();

  try {
    const company = await fetchCompanyDetails();
    if (company) {
      try {
        if (company.name) {
          document.title = `Messages - ${company.name}`;
        }
        const pageIcon = document.getElementById("pageIcon");
        if (pageIcon) {
          if (company.logoHtml) pageIcon.innerHTML = company.logoHtml;
          else if (company.altLogoHtml) pageIcon.innerHTML = company.altLogoHtml;
        }
        if (company.icon_logo_url) {
          let link = document.querySelector("link[rel~='icon']");
          if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
          }
          link.href = company.icon_logo_url;
        }
      } catch (e) {
        console.warn("Failed to apply company details to page", e);
      }
    }
  } catch (err) {
    console.warn("Failed to load company details", err);
  }

  
  try {
    await ensureModalHelpers();
  } catch (e) {
    console.debug('messages: ensureModalHelpers failed or timed out', e);
  }

  tryInitSocket();

  await loadConversationsOnly();
  renderChatContacts();
  updateAnnouncementsBadge();
  updateChatBadge();

  const role =
    currentUser && currentUser.role
      ? String(currentUser.role).toUpperCase()
      : "TENANT";
  const newMsgBtn = document.querySelector(
    'button[onclick="openNewMessageModal()"]'
  );
  const newAnnounceBtn = document.querySelector(
    'button[onclick="openCreateAnnouncementModal()"]'
  );
  if (newMsgBtn) {
    newMsgBtn.style.display =
      role === "ADMIN" || role === "MANAGER" ? "inline-flex" : "none";
  }
  if (newAnnounceBtn) {
    newAnnounceBtn.style.display =
      role === "ADMIN" || role === "MANAGER" ? "inline-flex" : "none";
  }
});



function ensureModalHelpers(timeoutMs = 2000) {
  return new Promise((resolve) => {
    try {
      if (typeof window !== 'undefined' && typeof window.showConfirm === 'function' && typeof window.Modal !== 'undefined') {
        return resolve(true);
      }

      let loaded = 0;
      function checkDone() {
        if (typeof window !== 'undefined' && typeof window.showConfirm === 'function' && typeof window.Modal !== 'undefined') {
          resolve(true);
          return true;
        }
        return false;
      }

      if (checkDone()) return;

      
      function inject(src) {
        return new Promise((res, rej) => {
          try {
            const found = Array.from(document.getElementsByTagName('script')).find(s => s.src && s.src.indexOf(src) !== -1);
            if (found) return res(found);
            const s = document.createElement('script');
            s.src = src;
            s.async = false;
            s.onload = () => res(s);
            s.onerror = (e) => rej(e);
            document.head.appendChild(s);
          } catch (e) { rej(e); }
        });
      }

      
      inject('/javascript/dialog-modal.js')
        .catch(() => null)
        .then(() => inject('/javascript/utils/modalHelpers.js').catch(() => null))
        .then(() => {
          if (checkDone()) return;
          
          const start = Date.now();
          const iv = setInterval(() => {
            if (checkDone() || Date.now() - start > timeoutMs) {
              clearInterval(iv);
              resolve(checkDone());
            }
          }, 100);
        })
        .catch(() => {
          
          const start = Date.now();
          const iv = setInterval(() => {
            if (checkDone() || Date.now() - start > timeoutMs) {
              clearInterval(iv);
              resolve(checkDone());
            }
          }, 100);
        });
    } catch (e) {
      resolve(false);
    }
  });
}

function switchTab(tabName, tabElement) {
  document
    .querySelectorAll(".nav-tab")
    .forEach((tab) => tab.classList.remove("active"));
  document
    .querySelectorAll(".tab-content")
    .forEach((content) => content.classList.remove("active"));

  tabElement.classList.add("active");
  document.getElementById(tabName + "Tab").classList.add("active");

  if (tabName === "chat" && !currentChatContact) {
    if (chatContacts.length > 0) {
      selectChatContact(chatContacts[0].id, { immediate: true });
    }
  }
}

function tryInitSocket() {
  try {
    if (!jwtToken) return;
    if (typeof io === "undefined") {
      console.warn("Socket.io client not loaded; skipping realtime");
      return;
    }
    socket = io({ auth: { token: jwtToken } });

    socket.on("connect", () => {
      console.info("Socket connected", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.info("Socket disconnected", reason);
    });

    socket.on("new_message", (msg) => {
      if (currentChatContact) {
        const convWith = [msg.sender_user_id, msg.recipient_user_id].find(
          (id) => id != currentUser.user_id
        );
        if (convWith == currentChatContact) {
          if (!chatMessagesCache[currentChatContact])
            chatMessagesCache[currentChatContact] = [];

          const incoming = {
            id: msg.message_id,
            text: msg.message,
            sent: msg.sender_user_id == currentUser.user_id,
            time: formatTime(msg.created_at),
            attachments: Array.isArray(msg.attachments) ? msg.attachments : [],
          };
          if (msg.tmpId) {
            const idx = chatMessagesCache[currentChatContact].findIndex(
              (m) => m.id === msg.tmpId
            );
            if (idx >= 0) {
              chatMessagesCache[currentChatContact][idx] = incoming;
            } else {
              chatMessagesCache[currentChatContact].push(incoming);
            }
          } else {
            chatMessagesCache[currentChatContact].push(incoming);
          }
          const contact = chatContacts.find((c) => c.id == currentChatContact);
          renderChatMain(contact);
          scrollChatToBottom();
          return;
        }
      }

      const contact = chatContacts.find((c) => c.id == msg.sender_user_id);
      if (contact) {
        contact.unreadCount = (contact.unreadCount || 0) + 1;
        updateChatBadge();
        renderChatContacts();
      }
    });

    socket.on("message_sent", (msg) => {
      if (String(msg.sender_user_id) !== String(currentUser.user_id)) {
        return;
      }
      const otherUserId = msg.recipient_user_id;
      if (
        currentChatContact &&
        String(currentChatContact) == String(otherUserId)
      ) {
        if (!chatMessagesCache[currentChatContact])
          chatMessagesCache[currentChatContact] = [];
        const incoming = {
          id: msg.message_id,
          text: msg.message,
          sent: msg.sender_user_id == currentUser.user_id,
          time: formatTime(msg.created_at),
          attachments: Array.isArray(msg.attachments) ? msg.attachments : [],
        };
        if (msg.tmpId) {
          const idx = chatMessagesCache[currentChatContact].findIndex(
            (m) => m.id === msg.tmpId
          );
          if (idx >= 0) {
            chatMessagesCache[currentChatContact][idx] = incoming;
          } else {
            chatMessagesCache[currentChatContact].push(incoming);
          }
        } else {
          const idx = chatMessagesCache[currentChatContact].findIndex(
            (m) =>
              String(m.text || "").trim() ===
                String(msg.message || "").trim() &&
              m.sent &&
              String(m.id || "").startsWith("tmp_")
          );
          if (idx >= 0) chatMessagesCache[currentChatContact][idx] = incoming;
          else chatMessagesCache[currentChatContact].push(incoming);
        }
        const contact = chatContacts.find((c) => c.id == currentChatContact);
        renderChatMain(contact);
        scrollChatToBottom();
      }
    });

    socket.on("conversation_updated", (payload) => {
      const otherId = payload.otherUserId;
      const c = chatContacts.find((x) => x.id == otherId);
      if (c) {
        c.lastMessage = payload.lastMessage;
        c.lastTime = payload.lastMessageTime
          ? formatTime(payload.lastMessageTime)
          : c.lastTime;
        renderChatContacts();
      }
    });

    socket.on("user_typing", (data) => {
      const { userId, isTyping } = data;
      if (
        currentChatContact &&
        parseInt(userId) === parseInt(currentChatContact)
      ) {
        showTypingIndicator(isTyping);
      }
    });

    socket.on("user_online", (data) => {
      const found = chatContacts.find((c) => c.id == data.userId);
      if (found) {
        found.online = true;
        renderChatContacts();
      }
    });

    socket.on("user_offline", (data) => {
      const found = chatContacts.find((c) => c.id == data.userId);
      if (found) {
        found.online = false;
        renderChatContacts();
      }
    });

    socket.on("message_deleted", (info) => {
      const { message_id, conversation_id } = info;
      if (currentChatContact && chatMessagesCache[currentChatContact]) {
        chatMessagesCache[currentChatContact] = chatMessagesCache[
          currentChatContact
        ].filter((m) => m.id != message_id);
        const contact = chatContacts.find((c) => c.id == currentChatContact);
        renderChatMain(contact);
      }
    });

    socket.on("message_updated", (updated) => {
      if (currentChatContact && chatMessagesCache[currentChatContact]) {
        const idx = chatMessagesCache[currentChatContact].findIndex(
          (m) => m.id == updated.message_id
        );
        if (idx >= 0) {
          chatMessagesCache[currentChatContact][idx].text = updated.message;
          const contact = chatContacts.find((c) => c.id == currentChatContact);
          renderChatMain(contact);
        }
      }
    });
  } catch (err) {
    console.warn("Socket init failed", err);
  }
}

function formatTime(raw) {
  return formatTimeFlexible(raw, {
    timeZone: "Asia/Manila",
    includeDate: true,
    locale: "en-PH",
  });
}

function renderAnnouncements() {
  let filtered = announcements;

  if (currentAnnouncementFilter !== "all") {
    filtered = announcements.filter((a) => {
      if (currentAnnouncementFilter === "important")
        return a.priority === "high";
      return a.category === currentAnnouncementFilter;
    });
  }

  filtered.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.date) - new Date(a.date);
  });

  const startIndex = (currentPage - 1) * announcementsPerPage;
  const endIndex = startIndex + announcementsPerPage;
  const paginatedAnnouncements = filtered.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filtered.length / announcementsPerPage);

  let html = "";
  paginatedAnnouncements.forEach((announcement) => {
    const pinnedClass = announcement.pinned ? "pinned" : "";
    const pinnedIcon = announcement.pinned
      ? '<i class="fas fa-thumbtack announcement-pin"></i>'
      : "";

    html += `
            <div class="announcement-card ${pinnedClass}" onclick="viewAnnouncement(${
      announcement.id
    })">
                <div class="announcement-header">
                    <span class="announcement-category ${
                      announcement.category
                    }">
                        <i class="fas fa-${getCategoryIcon(
                          announcement.category
                        )}"></i>
                        ${announcement.category}
                    </span>
                    ${pinnedIcon}
                </div>
                <h3 class="announcement-title">${announcement.title}</h3>
                <p class="announcement-content">${announcement.content}</p>
                <div class="announcement-footer">
                    <div class="announcement-meta">
                        <span><i class="fas fa-calendar"></i> ${
                          announcement.date
                        }</span>
                        <span><i class="fas fa-clock"></i> ${
                          announcement.time
                        }</span>
                    </div>
                    <div class="announcement-priority ${announcement.priority}">
                        <i class="fas fa-circle"></i>
                        ${announcement.priority}
                    </div>
                </div>
            </div>
        `;
  });

  if (!html) {
    html = `
            <div style="padding: 1rem; color: var(--text-muted);">No announcements yet.</div>
        `;
  }
  document.getElementById("announcementsList").innerHTML = html;

  if (totalPages > 1) {
    const paginationHTML = createPagination(
      filtered.length,
      currentPage,
      announcementsPerPage
    );
    document
      .querySelector(".announcements-list-container")
      .insertAdjacentHTML("beforeend", paginationHTML);
  }
}

function getCategoryIcon(category) {
  const icons = {
    general: "info-circle",
    maintenance: "tools",
    events: "calendar-alt",
    policy: "file-alt",
    emergency: "exclamation-triangle",
  };
  return icons[category] || "info-circle";
}

function setAnnouncementFilter(filter, buttonElement) {
  currentAnnouncementFilter = filter;
  currentPage = 1;

  document
    .querySelectorAll(".filter-chip")
    .forEach((btn) => btn.classList.remove("active"));
  buttonElement.classList.add("active");

  renderAnnouncements();
}

function viewAnnouncement(id) {
  const announcement = announcements.find((a) => a.id === id);
  if (!announcement) return;

  document.getElementById("modalAnnouncementTitle").innerHTML = `
        ${announcement.title}
        ${
          announcement.pinned
            ? '<i class="fas fa-thumbtack" style="color: var(--warning-color); font-size: 1rem; margin-left: 0.5rem;"></i>'
            : ""
        }
    `;

  document.getElementById("modalAnnouncementMeta").innerHTML = `
        <div><i class="fas fa-user"></i> ${announcement.author}</div>
        <div><i class="fas fa-calendar"></i> ${announcement.date}</div>
        <div><i class="fas fa-clock"></i> ${announcement.time}</div>
        <div>
            <span class="announcement-category ${announcement.category}">
                <i class="fas fa-${getCategoryIcon(announcement.category)}"></i>
                ${announcement.category}
            </span>
            <div style="margin-left:auto; display:flex; align-items:center; gap:0.5rem;">
                <button type="button" onclick="openConversationMedia()" title="View media & files" style="border:none; background:transparent; color: var(--primary-color); cursor:pointer; font-size:1rem;">
                    <i class="fas fa-folder-open"></i>
                </button>
            </div>
        </div>
        <div>
            <span class="announcement-priority ${announcement.priority}">
                <i class="fas fa-circle"></i>
                ${announcement.priority}
            </span>
        </div>
    `;

  document.getElementById("modalAnnouncementContent").textContent =
    announcement.content;

  showModal("viewAnnouncementModal");
}

function openCreateAnnouncementModal() {
  document.getElementById("announcementTitle").value = "";
  document.getElementById("announcementCategory").value = "general";
  document.getElementById("announcementContent").value = "";
  document.getElementById("pinAnnouncement").checked = false;
  document.querySelectorAll('input[name="priority"]')[1].checked = true;

  showModal("createAnnouncementModal");
}

function createAnnouncement() {
  const title = document.getElementById("announcementTitle").value;
  const category = document.getElementById("announcementCategory").value;
  const content = document.getElementById("announcementContent").value;
  const pinned = document.getElementById("pinAnnouncement").checked;
  const priority = document.querySelector(
    'input[name="priority"]:checked'
  ).value;

  if (!title || !content) {
    showNotification("Please fill in all required fields", "error");
    return;
  }

  const newAnnouncement = {
    id: announcements.length + 1,
    title,
    category,
    priority,
    content,
    date: new Date().toISOString().split("T")[0],
    time: new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    author:
      currentUser && (currentUser.first_name || currentUser.last_name)
        ? `${currentUser.first_name || ""} ${
            currentUser.last_name || ""
          }`.trim()
        : "Admin",
    pinned,
  };

  announcements.unshift(newAnnouncement);
  closeModal("createAnnouncementModal");
  renderAnnouncements();
  updateAnnouncementsBadge();
  showNotification("Announcement published successfully!", "success");
}

function createPagination(totalItems, currentPage, itemsPerPage) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (totalPages <= 1) return "";

  let paginationHTML = '<div class="pagination-container">';

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  paginationHTML += `
        <div class="pagination-info">
            <i class="fas fa-bullhorn"></i>
            Showing ${startItem}-${endItem} of ${totalItems} announcements
        </div>
    `;

  paginationHTML += '<div class="pagination-controls">';

  paginationHTML += `
        <div class="per-page-selector">
            <span>Show:</span>
            <select id="announcementsPerPageSelect" onchange="changeAnnouncementsPerPage(this.value)">
                <option value="6" ${
                  itemsPerPage === 6 ? "selected" : ""
                }>6</option>
                <option value="12" ${
                  itemsPerPage === 12 ? "selected" : ""
                }>12</option>
                <option value="18" ${
                  itemsPerPage === 18 ? "selected" : ""
                }>18</option>
                <option value="24" ${
                  itemsPerPage === 24 ? "selected" : ""
                }>24</option>
            </select>
        </div>
    `;

  paginationHTML += `
        <button onclick="goToPage(${currentPage - 1})" ${
    currentPage <= 1 ? "disabled" : ""
  } class="pagination-btn">
            <i class="fas fa-chevron-left"></i> Previous
        </button>
    `;

  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  if (startPage > 1) {
    paginationHTML += `<button onclick="goToPage(1)" class="pagination-btn">1</button>`;
    if (startPage > 2) {
      paginationHTML += `<span class="pagination-ellipsis">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const activeClass = i === currentPage ? "active" : "";
    paginationHTML += `<button onclick="goToPage(${i})" class="pagination-btn ${activeClass}">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      paginationHTML += `<span class="pagination-ellipsis">...</span>`;
    }
    paginationHTML += `<button onclick="goToPage(${totalPages})" class="pagination-btn">${totalPages}</button>`;
  }

  paginationHTML += `
        <button onclick="goToPage(${currentPage + 1})" ${
    currentPage >= totalPages ? "disabled" : ""
  } class="pagination-btn">
            Next <i class="fas fa-chevron-right"></i>
        </button>
    `;

  paginationHTML += "</div></div>";

  return paginationHTML;
}

function goToPage(page) {
  const totalPages = Math.ceil(announcements.length / announcementsPerPage);
  if (page < 1 || page > totalPages) return;

  currentPage = page;
  renderAnnouncements();
}

function changeAnnouncementsPerPage(newPerPage) {
  announcementsPerPage = parseInt(newPerPage);
  currentPage = 1;
  renderAnnouncements();
}

async function loadConversationsOnly() {
  try {
    chatContacts = [];
    if (currentUser && currentUser.user_id) {
      try {
        console.debug("messages: loadConversationsOnly - fetching conversations", {
          jwtPresent: !!jwtToken,
          currentUser: currentUser ? { id: currentUser.user_id, role: currentUser.role } : null,
        });

        const convRes = await fetch(
          `${API_BASE}/messages/conversations/${currentUser.user_id}`,
          { credentials: "include" }
        );

        let convs = null;
        try {
          convs = await convRes.json();
        } catch (e) {
          console.warn("messages: conversations response JSON parse failed", e);
          convs = null;
        }

        console.debug("messages: conversations fetch result", { status: convRes.status, ok: convRes.ok, bodySample: Array.isArray(convs) ? convs.slice(0,3) : convs });

        chatContacts = (convs || []).map((c) => ({
          id: c.other_user_id,
          name: c.other_user_name,
          avatar: getInitialsFromName(c.other_user_name),
          avatarUrl: c.other_user_avatar || null,
          online: false,
          lastMessage: c.last_message || "",
          lastTime: c.last_message_time ? formatTime(c.last_message_time) : "",
          unreadCount: 0,
        }));
      } catch (e) {
        console.error("messages: failed to fetch conversations", e);
        chatContacts = [];
      }
    }
  } catch (e) {
    console.error("Failed to load contacts", e);
  }
}

function renderChatContacts() {
  let html = "";
  chatContacts.forEach((contact) => {
    const onlineClass = contact.online ? "online" : "";
    const activeClass =
      String(currentChatContact) === String(contact.id) ? "active" : "";
    const unreadBadge =
      contact.unreadCount > 0
        ? `<span class="unread-count">${contact.unreadCount}</span>`
        : "";

    const safeId = String(contact.id).replace(/'/g, "\\'");
    const safeName = escapeHtml(contact.name || "");
    const safeLast = escapeHtml(contact.lastMessage || "");
    const highlightedName = lastChatSearchQuery
      ? highlightMatch(safeName, lastChatSearchQuery)
      : safeName;
    const highlightedLast = lastChatSearchQuery
      ? highlightMatch(safeLast, lastChatSearchQuery)
      : safeLast;

    html += `
            <div class="contact-item ${activeClass}" onclick="selectChatContact('${safeId}')">
        ${createAvatarHtml(contact.avatarUrl || null, contact.name || "", 36, onlineClass)}
                <div class="contact-info">
          <div class="contact-name">${highlightedName}</div>
          <div class="contact-last-message">${highlightedLast}</div>
                </div>
                <div class="contact-meta">
                    <div class="contact-time">${contact.lastTime}</div>
                    ${unreadBadge}
                </div>
            </div>
        `;
  });

  document.getElementById("chatContacts").innerHTML = html;
}

async function selectChatContact(contactId, options = {}) {
  currentChatContact = contactId;
  const contact = chatContacts.find((c) => String(c.id) === String(contactId));

  renderChatContacts();

  renderChatSkeleton(contact);

  try {
    if (!chatMessagesCache[contactId]) {
      await loadMessagesForContact(contactId);
    }
  } catch (e) {
    console.error("Failed to load messages for contact", contactId, e);
    chatMessagesCache[contactId] = chatMessagesCache[contactId] || [];
  }

  renderChatMain(contact);
  scrollChatToBottom();

  pendingAttachments = [];
  const previewEl = document.getElementById("attachmentsPreview");
  if (previewEl) {
    previewEl.innerHTML = "";
    previewEl.style.display = "none";
  }
  updateSendButtonState();

  try {
    if (window.innerWidth <= 768) {
      closeChatSidebarMobile();
    }
  } catch {}
}

function renderChatMain(contact) {
  const messages = chatMessagesCache[contact.id] || [];

  let html = `
        <div class="chat-main-header" style="padding: 1.25rem; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 1rem; background: var(--background-white); flex-shrink: 0;">
            <button type="button" class="chat-mobile-toggle-btn" onclick="openChatSidebarMobile()" title="Conversations" style="display:none; border:none; background:transparent; color: var(--primary-color); font-size:1.25rem; cursor:pointer;">
                <i class="fas fa-bars"></i>
            </button>
            ${createAvatarHtml(contact.avatarUrl || null, contact.name || "User", 36, contact.online ? "online" : "")}
            <div>
                <h3 style="font-size: 1.125rem; font-weight: 600; color: var(--text-primary); margin: 0;">${
                  contact.name
                }</h3>
                <p style="font-size: 0.8125rem; color: var(--text-muted); margin: 0;">${
                  contact.online ? "Online now" : "Offline"
                }</p>
            </div>
            <div style="margin-left:auto; display:flex; align-items:center; gap:0.5rem;">
                <button type="button" title="View media & files" onclick="openConversationMedia()" style="border:none; background:transparent; color: var(--primary-color); cursor:pointer; font-size:1rem;">
                    <i class="fas fa-folder-open"></i>
                </button>
            </div>
        </div>
        <div class="chat-messages" id="chatMessages" style="flex:1; overflow:auto; display:flex; flex-direction:column; gap:0.5rem; padding:1rem; background: var(--background-light)">
            ${renderChatMessages(messages)}
            <div id="typingIndicator" style="display:none; color: var(--text-muted); font-size: 0.8125rem; margin: 0.5rem 1rem;">Typing...</div>
        </div>
        <div class="chat-input-container" style="border-top:1px solid var(--border-color); padding:0.75rem; background: var(--background-white);">
            <div class="chat-input-wrapper" id="chatInputWrapper" style="position:relative; display:flex; align-items:flex-end; gap:0.5rem; border:1px solid var(--border-color); border-radius:0.5rem; padding:0.5rem; background: var(--background-light)"
                ondragenter="handleDragEnter(event)" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event)">
                <textarea id="chatInput" placeholder="Type your message..." rows="1" oninput="autoResizeTextarea(this)" onkeydown="handleChatKeyDown(event)" onfocus="focusChatInput(this)" onblur="blurChatInput(this)" style="flex:1 1 auto; width:100%; resize:none; border:none; outline:none; background:transparent; min-height:32px;"></textarea>
                <button class="image-upload-btn" onclick="openAttachmentPicker()" title="Attach files">
                    <i class="fas fa-image"></i>
                </button>
                <input type="file" id="imageUpload" multiple style="display: none;" onchange="handleImageUpload(event)">
                <button class="image-upload-btn" onclick="toggleEmojiPicker()" title="Insert emoji">
                    <i class="fas fa-face-smile"></i>
                </button>
                <button class="chat-send-btn" onclick="sendChatMessage()" id="sendBtn" disabled style="display:inline-flex; align-items:center; justify-content:center; height:2.25rem; width:2.5rem; border:none; border-radius:0.375rem; background: var(--primary-color); color:white; opacity:0.7">
                    <i class="fas fa-paper-plane"></i>
                </button>
                                <div id="dropHint" style="display:none; position:absolute; inset:0; border:2px dashed var(--primary-color); border-radius:0.5rem; background:rgba(99,102,241,0.06); align-items:center; justify-content:center; color:var(--primary-color); font-size:0.9rem; pointer-events:none;">
                  Drop files to attach
                </div>
            </div>
            <div id="attachmentsPreview" style="display:none; margin-top:0.5rem; gap:0.5rem; flex-wrap:wrap"></div>
                <div id="emojiPicker" style="display:none; margin-top:0.5rem; background: var(--background-white); border:1px solid var(--border-color); border-radius:0.5rem; padding:0.5rem; max-width:20rem; max-height:12rem; overflow:auto;">
                <div style="display:flex; flex-wrap:wrap; gap:0.25rem;">
                    ${[
                      "😀",
                      "😁",
                      "😂",
                      "🤣",
                      "😃",
                      "😄",
                      "😅",
                      "🙂",
                      "🙃",
                      "😉",
                      "😊",
                      "😇",
                      "😍",
                      "😘",
                      "😗",
                      "😙",
                      "😚",
                      "😋",
                      "😜",
                      "🤪",
                      "🤩",
                      "🤗",
                      "🤔",
                      "🤨",
                      "😐",
                      "😑",
                      "😶",
                      "🙄",
                      "😏",
                      "😴",
                      "😪",
                      "😮",
                      "😲",
                      "😳",
                      "😱",
                      "😭",
                      "😡",
                      "🤬",
                      "👍",
                      "👎",
                      "👏",
                      "🙌",
                      "🙏",
                      "💪",
                      "🤝",
                      "👀",
                      "🎉",
                      "✨",
                      "🔥",
                      "💯",
                      "✅",
                      "❌",
                      "☕",
                      "🍕",
                      "🍔",
                      "🍟",
                      "🍩",
                      "🍪",
                      "🍰",
                      "🍻",
                      "🍷",
                      "🍎",
                      "🍔",
                      "🥗",
                      "🚀",
                      "💡",
                      "📎",
                      "📷",
                      "🖼️",
                      "📍",
                    ]
                      .map(
                        (e) =>
                          `<button type="button" style="border:none;background:none;font-size:1.25rem;cursor:pointer" onclick="insertEmoji('${e}')">${e}</button>`
                      )
                      .join("")}
                </div>
            </div>
            <div style="margin-top:0.5rem; color: var(--text-light); font-size: 0.75rem;">Press Enter to send • Shift+Enter for a new line</div>
        </div>
    `;

  document.getElementById("chatMain").innerHTML = html;

  if (socket && currentUser) {
    const otherUserId = contact.id;
    socket.emit("join_conversation", { otherUserId });
  }
  updateSendButtonState();

  scrollChatToBottom();

  attachChatInputWrapperFocus();
}

function renderChatSkeleton(contact) {
  const skeletonBubble = (alignRight = false) => `
      <div style="display:flex; justify-content:${
        alignRight ? "flex-end" : "flex-start"
      };">
        <div style="width:60%; height:2.25rem; background:linear-gradient(90deg, #f2f3f7 25%, #e9ebf2 37%, #f2f3f7 63%); background-size:400% 100%; border-radius:0.75rem; animation: shimmer 1.2s infinite;">
        </div>
      </div>`;

  const html = `
        <div class="chat-main-header" style="padding: 1.25rem; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 1rem; background: var(--background-white); flex-shrink: 0;">
            <div class="contact-avatar ${contact.online ? "online" : ""}">${
    contact.avatar
  }</div>
            <div>
                <h3 style="font-size: 1.125rem; font-weight: 600; color: var(--text-primary); margin: 0;">${
                  contact.name
                }</h3>
                <p style="font-size: 0.8125rem; color: var(--text-muted); margin: 0;">Loading conversation…</p>
            </div>
        </div>
        <div class="chat-messages" id="chatMessages" style="flex:1; overflow:auto; display:flex; flex-direction:column; gap:0.75rem; padding:1rem; background: var(--background-light)">
            ${skeletonBubble(false)}
            ${skeletonBubble(true)}
            ${skeletonBubble(false)}
        </div>
        <div class="chat-input-container" style="border-top:1px solid var(--border-color); padding:0.75rem; background: var(--background-white);">
            <div class="chat-input-wrapper" id="chatInputWrapper" style="display:flex; align-items:flex-end; gap:0.5rem; border:1px solid var(--border-color); border-radius:0.5rem; padding:0.5rem; background: var(--background-light)">
                <textarea id="chatInput" placeholder="Type your message..." rows="1" oninput="autoResizeTextarea(this)" onkeydown="handleChatKeyDown(event)" onfocus="focusChatInput(this)" onblur="blurChatInput(this)" style="flex:1 1 auto; width:100%; resize:none; border:none; outline:none; background:transparent; min-height:32px;"></textarea>
                <button class="image-upload-btn" onclick="document.getElementById('imageUpload').click()" title="Attach files">
                    <i class="fas fa-image"></i>
                </button>
                <input type="file" id="imageUpload" multiple style="display: none;" onchange="handleImageUpload(event)">
                <button class="image-upload-btn" onclick="toggleEmojiPicker()" title="Insert emoji">
                    <i class="fas fa-face-smile"></i>
                </button>
                <button class="chat-send-btn" onclick="sendChatMessage()" id="sendBtn" disabled style="display:inline-flex; align-items:center; justify-content:center; height:2.25rem; width:2.5rem; border:none; border-radius:0.375rem; background: var(--primary-color); color:white; opacity:0.7">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
            <div id="attachmentsPreview" style="display:none; margin-top:0.5rem; gap:0.5rem; flex-wrap:wrap"></div>
            <div id="emojiPicker" style="display:none; margin-top:0.5rem; background: var(--background-white); border:1px solid var(--border-color); border-radius:0.5rem; padding:0.5rem; max-width:18rem;"></div>
            <div style="margin-top:0.5rem; color: var(--text-light); font-size: 0.75rem;">Press Enter to send • Shift+Enter for a new line</div>
        </div>
    `;
  document.getElementById("chatMain").innerHTML = html;
}

(() => {
  if (document.getElementById("chatShimmerStyle")) return;
  const style = document.createElement("style");
  style.id = "chatShimmerStyle";
  style.textContent = `@keyframes shimmer { 0%{background-position:100% 0} 100%{background-position:0 0} }`;
  document.head.appendChild(style);
})();

function renderChatMessages(messages) {
  return messages
    .map((msg) => {
      const align = msg.sent ? "flex-end" : "flex-start";
      const bubbleBg = msg.sent ? "var(--primary-color)" : "#ffffff";
      const textColor = msg.sent ? "#ffffff" : "var(--text-primary)";
      const border = msg.sent ? "none" : "1px solid var(--border-color)";
      const safeText = escapeHtml(String(msg.text || ""));
      const attachmentsHtml =
        Array.isArray(msg.attachments) && msg.attachments.length
          ? (() => {
              const images = [];
              const files = [];
              msg.attachments.forEach((a) => {
                const isImg = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(
                  a.filename || a.url
                );
                const fname = escapeHtml(a.filename || "Attachment");
                if (isImg) {
                  images.push(
                    `<button type="button" class="chat-image-thumb" onclick="openImageModal('${encodeURIComponent(
                      a.url
                    )}', '${encodeURIComponent(fname)}', ${
                      msg.id
                    })" style="display:inline-block; padding:0; border:none; background:none; cursor:zoom-in"><img src="${
                      a.url
                    }" alt="${fname}" style="max-width:160px; max-height:120px; border-radius:0.5rem; border:1px solid var(--border-color);"/></button>`
                  );
                } else {
                  files.push({ url: a.url, name: fname });
                }
              });
              const imagesHtml = images.length
                ? `<div class="image-message" style="margin-top:0.25rem; display:flex; gap:0.5rem; flex-wrap:wrap;">${images.join(
                    ""
                  )}</div>`
                : "";
              const filesHtml = files.length
                ? `<div class="file-list" style="margin-top:${
                    images.length ? ".25rem" : "0"
                  }; display:flex; flex-direction:column; gap:0.25rem;">${files
                    .map((f) => {
                      const ext = (f.name || "").split(".").pop() || "";
                      const fileIcon = /pdf/i.test(ext)
                        ? "fa-file-pdf"
                        : /doc|docx/i.test(ext)
                        ? "fa-file-word"
                        : /xls|xlsx/i.test(ext)
                        ? "fa-file-excel"
                        : /zip|rar|7z/i.test(ext)
                        ? "fa-file-archive"
                        : "fa-file";
                      return `<div style="display:flex; align-items:center; gap:0.5rem;">
                                    <i class='fas ${fileIcon}' style="color: var(--text-muted); width:20px;"></i>
                                    <a href="${
                                      f.url
                                    }" target="_blank" rel="noopener" style="display:inline-block;color:${
                        msg.sent ? "#E0E7FF" : "var(--primary-color)"
                      }">${f.name}</a>
                                    <a href="${
                                      f.url
                                    }" download style="margin-left:auto; color:inherit; text-decoration:none; padding:0.25rem; border-radius:0.25rem;" title="Download"><i class='fas fa-download' style="color: var(--text-muted)"></i></a>
                                </div>`;
                    })
                    .join("")}</div>`
                : "";
              return imagesHtml + filesHtml;
            })()
          : "";
      return `
            <div style="display:flex; justify-content:${align};">
              <div class="message-bubble" style="max-width:70%; background:${bubbleBg}; color:${textColor}; border:${border}; border-radius:0.75rem; padding:0.5rem 0.75rem; box-shadow:0 1px 1px rgba(0,0,0,0.05)">
                <div class="message-text" style="white-space:pre-wrap; word-wrap:break-word;">${safeText}</div>
                ${attachmentsHtml}
                <div class="message-time" style="font-size:0.75rem; opacity:0.8; margin-top:0.25rem; text-align:${
                  msg.sent ? "right" : "left"
                };">${msg.time}</div>
              </div>
            </div>`;
    })
    .join("");
}

let imageModalState = { messageId: null, items: [], index: 0 };

function ensureImageModal() {
  if (document.getElementById("imageModalOverlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "imageModalOverlay";
  overlay.style.cssText = `position:fixed; inset:0; background:rgba(0,0,0,0.8); display:none; align-items:center; justify-content:center; z-index:1000;`;
  overlay.innerHTML = `
      <div id="imageModalContent" style="position:relative; max-width:95vw; max-height:90vh; display:flex; align-items:center; justify-content:center;">
        <button id="imgPrev" style="position:absolute; left:-3rem; top:50%; transform:translateY(-50%); background:rgba(255,255,255,0.15); color:#fff; border:none; width:2.5rem; height:2.5rem; border-radius:50%; cursor:pointer"><i class="fas fa-chevron-left"></i></button>
        <img id="imageModalImg" src="" alt="" style="max-width:95vw; max-height:90vh; border-radius:0.5rem; box-shadow:0 10px 30px rgba(0,0,0,0.35)"/>
        <button id="imgNext" style="position:absolute; right:-3rem; top:50%; transform:translateY(-50%); background:rgba(255,255,255,0.15); color:#fff; border:none; width:2.5rem; height:2.5rem; border-radius:50%; cursor:pointer"><i class="fas fa-chevron-right"></i></button>
        <button id="imgClose" style="position:absolute; right:-0.5rem; top:-0.5rem; background:rgba(0,0,0,0.6); color:#fff; border:none; width:2rem; height:2rem; border-radius:50%; cursor:pointer"><i class="fas fa-times"></i></button>
        <div id="imgCaption" style="position:absolute; left:0; bottom:-2.25rem; color:#fff; font-size:0.9rem; opacity:0.9; max-width:90vw; overflow:hidden; text-overflow:ellipsis; white-space:nowrap"></div>
      </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => {
    if (e.target.id === "imageModalOverlay") closeImageModal();
  });
  overlay.querySelector("#imgClose").addEventListener("click", closeImageModal);
  overlay
    .querySelector("#imgPrev")
    .addEventListener("click", () => stepImage(-1));
  overlay
    .querySelector("#imgNext")
    .addEventListener("click", () => stepImage(1));
  document.addEventListener("keydown", imageModalKeydown);
}

function imageModalKeydown(e) {
  const ov = document.getElementById("imageModalOverlay");
  if (!ov || ov.style.display === "none") return;
  if (e.key === "Escape") closeImageModal();
  if (e.key === "ArrowLeft") stepImage(-1);
  if (e.key === "ArrowRight") stepImage(1);
}

function openImageModal(encUrl, encName, messageId) {
  ensureImageModal();

  const msgs = chatMessagesCache[currentChatContact] || [];
  const msg = msgs.find((m) => m.id === messageId);
  const images = (msg?.attachments || []).filter((a) =>
    /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a.filename || a.url)
  );
  imageModalState.messageId = messageId;
  imageModalState.items = images.map((a) => ({
    url: a.url,
    name: a.filename || "Image",
  }));
  const url = decodeURIComponent(encUrl);
  const name = decodeURIComponent(encName);
  imageModalState.index = Math.max(
    0,
    imageModalState.items.findIndex((i) => i.url === url)
  );

  const ov = document.getElementById("imageModalOverlay");
  const img = document.getElementById("imageModalImg");
  const cap = document.getElementById("imgCaption");
  img.src = url;
  img.alt = name;
  cap.textContent = name;
  ov.style.display = "flex";
  initImagePanZoom();
}

function stepImage(delta) {
  if (!imageModalState.items.length) return;
  imageModalState.index =
    (imageModalState.index + delta + imageModalState.items.length) %
    imageModalState.items.length;
  const item = imageModalState.items[imageModalState.index];
  const img = document.getElementById("imageModalImg");
  const cap = document.getElementById("imgCaption");
  if (img && cap) {
    img.src = item.url;
    img.alt = item.name;
    cap.textContent = item.name;
  }
}

function closeImageModal() {
  const ov = document.getElementById("imageModalOverlay");
  if (ov) ov.style.display = "none";
}

let panZoom = { scale: 1, x: 0, y: 0, dragging: false, lastX: 0, lastY: 0 };
function initImagePanZoom() {
  const img = document.getElementById("imageModalImg");
  if (!img) return;
  panZoom = { scale: 1, x: 0, y: 0, dragging: false, lastX: 0, lastY: 0 };
  img.style.cursor = "grab";
  img.style.transform = "translate(0px, 0px) scale(1)";
  img.onwheel = (e) => {
    e.preventDefault();
    const delta = -Math.sign(e.deltaY) * 0.1;
    const newScale = Math.min(4, Math.max(1, panZoom.scale + delta));
    panZoom.scale = newScale;
    img.style.transform = `translate(${panZoom.x}px, ${panZoom.y}px) scale(${panZoom.scale})`;
    img.style.cursor = panZoom.scale > 1 ? "grab" : "default";
  };
  img.onmousedown = (e) => {
    if (panZoom.scale <= 1) return;
    panZoom.dragging = true;
    panZoom.lastX = e.clientX;
    panZoom.lastY = e.clientY;
    img.style.cursor = "grabbing";
  };
  window.onmouseup = () => {
    if (!panZoom.dragging) return;
    panZoom.dragging = false;
    img.style.cursor = "grab";
  };
  window.onmousemove = (e) => {
    if (!panZoom.dragging) return;
    const dx = e.clientX - panZoom.lastX;
    const dy = e.clientY - panZoom.lastY;
    panZoom.x += dx;
    panZoom.y += dy;
    panZoom.lastX = e.clientX;
    panZoom.lastY = e.clientY;
    img.style.transform = `translate(${panZoom.x}px, ${panZoom.y}px) scale(${panZoom.scale})`;
  };
}

function ensureMediaModal() {
  if (document.getElementById("convMediaOverlay")) return;
  const ov = document.createElement("div");
  ov.id = "convMediaOverlay";
  ov.style.cssText =
    "position:fixed; inset:0; background:rgba(0,0,0,0.7); display:none; z-index:1000;";
  ov.innerHTML = `
            <div id="convMediaPanel" style="position:absolute; right:24px; bottom:24px; top:72px; left:auto; width:min(900px,90vw); background:#fff; border-radius:0.5rem; padding:1rem; display:flex; flex-direction:column; box-shadow:0 10px 30px rgba(0,0,0,0.2);">
                <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--border-color); padding-bottom:0.5rem;">
          <h3 style="margin:0; font-size:1rem;">Conversation media & files</h3>
          <button onclick="closeConversationMedia()" style="border:none;background:transparent;font-size:1.125rem;cursor:pointer"><i class="fas fa-times"></i></button>
        </div>
                <div id="convMediaTabs" style="display:flex; gap:0.75rem; margin:0.75rem 0; position:sticky; top:0; background:#fff; z-index:2; padding-top:0.25rem;">
          <button id="tabMedia" class="active" onclick="switchConvMediaTab('media')" style="border:1px solid var(--border-color); background:#f8f9fb; padding:0.375rem 0.75rem; border-radius:0.375rem; cursor:pointer">Images</button>
          <button id="tabFiles" onclick="switchConvMediaTab('files')" style="border:1px solid var(--border-color); background:#f8f9fb; padding:0.375rem 0.75rem; border-radius:0.375rem; cursor:pointer">Files</button>
        </div>
        <div id="convMediaBody" style="flex:1; overflow:auto; display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:0.75rem;"></div>
      </div>`;
  document.body.appendChild(ov);
}

function openConversationMedia() {
  if (!currentChatContact) return;
  ensureMediaModal();
  populateConversationMedia("media");
  const ov = document.getElementById("convMediaOverlay");
  if (ov) {
    ov.style.display = "block";
    updateConversationMediaLayout();
    try {
      const sidebar = document.querySelector(".sidebar");
      if (sidebar && !sidebar.__mediaObserverAttached) {
        const mo = new MutationObserver(() => updateConversationMediaLayout());
        mo.observe(sidebar, {
          attributes: true,
          attributeFilter: ["class", "style"],
        });
        sidebar.__mediaObserverAttached = true;
      }
    } catch {}
  }
}

function closeConversationMedia() {
  const ov = document.getElementById("convMediaOverlay");
  if (ov) ov.style.display = "none";
}

function switchConvMediaTab(tab) {
  const tabMedia = document.getElementById("tabMedia");
  const tabFiles = document.getElementById("tabFiles");
  if (tab === "media") {
    tabMedia.classList.add("active");
    tabFiles.classList.remove("active");
  } else {
    tabFiles.classList.add("active");
    tabMedia.classList.remove("active");
  }
  populateConversationMedia(tab);
}

function populateConversationMedia(tab) {
  const body = document.getElementById("convMediaBody");
  if (!body) return;
  const msgs = chatMessagesCache[currentChatContact] || [];
  const atts = msgs.flatMap((m) =>
    Array.isArray(m.attachments)
      ? m.attachments.map((a) => ({ ...a, messageId: m.id }))
      : []
  );
  const isImg = (a) =>
    /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a.filename || a.url);
  body.innerHTML = "";
  if (tab === "media") {
    const imgs = atts.filter(isImg);
    body.style.display = "grid";
    imgs.forEach((a) => {
      const fname = escapeHtml(a.filename || "Image");
      const div = document.createElement("div");
      div.innerHTML = `<button type="button" onclick="openImageModal('${encodeURIComponent(
        a.url
      )}','${encodeURIComponent(fname)}', ${
        a.messageId
      })" style="border:none;background:none;cursor:zoom-in;padding:0"><img src="${
        a.url
      }" alt="${fname}" style="width:100%;height:120px;object-fit:cover;border-radius:0.375rem;border:1px solid var(--border-color)"/></button>`;
      body.appendChild(div);
    });
  } else {
    const files = atts.filter((a) => !isImg(a));
    body.style.display = "block";
    if (files.length === 0) {
      body.innerHTML =
        '<div style="padding:1rem; color: var(--text-muted);">No files attached.</div>';
      return;
    }

    const perPage = 20;
    const page = parseInt(body.getAttribute("data-page") || "1", 10);
    const totalPages = Math.ceil(files.length / perPage) || 1;
    const start = (page - 1) * perPage;
    const pageItems = files.slice(start, start + perPage);

    body.innerHTML = pageItems
      .map((f) => {
        const ext = (f.filename || f.url || "").split(".").pop() || "";
        const fileIcon = /pdf/i.test(ext)
          ? "fa-file-pdf"
          : /doc|docx/i.test(ext)
          ? "fa-file-word"
          : /xls|xlsx/i.test(ext)
          ? "fa-file-excel"
          : /zip|rar|7z/i.test(ext)
          ? "fa-file-archive"
          : "fa-file";
        return `<div style="display:flex; align-items:center; gap:0.5rem; padding:0.375rem 0; border-bottom:1px solid var(--border-color)"><i class="fas ${fileIcon}" style="color: var(--text-muted)"></i><a href="${
          f.url
        }" target="_blank" rel="noopener" style="color: var(--primary-color)">${escapeHtml(
          f.filename || "Attachment"
        )}</a><a href="${
          f.url
        }" download style="margin-left:auto; color:inherit; text-decoration:none; padding:0.25rem; border-radius:0.25rem;" title="Download"><i class='fas fa-download' style="color: var(--text-muted)"></i></a></div>`;
      })
      .join("");

    if (totalPages > 1) {
      const pager = document.createElement("div");
      pager.style.cssText =
        "display:flex; gap:0.5rem; justify-content:center; padding:0.5rem 0";
      const prevBtn = document.createElement("button");
      prevBtn.textContent = "Prev";
      prevBtn.disabled = page <= 1;
      prevBtn.onclick = () => {
        body.setAttribute("data-page", String(page - 1));
        populateConversationMedia("files");
      };
      const nextBtn = document.createElement("button");
      nextBtn.textContent = "Next";
      nextBtn.disabled = page >= totalPages;
      nextBtn.onclick = () => {
        body.setAttribute("data-page", String(page + 1));
        populateConversationMedia("files");
      };
      pager.appendChild(prevBtn);
      pager.appendChild(
        document.createTextNode(` Page ${page} of ${totalPages} `)
      );
      pager.appendChild(nextBtn);
      body.appendChild(pager);
    }
  }
}

function updateConversationMediaLayout() {
  const panel = document.getElementById("convMediaPanel");
  const body = document.getElementById("convMediaBody");
  if (!panel) return;
  const isMobile = window.innerWidth <= 768;
  let sidebarWidth = 0;
  if (!isMobile) {
    const sidebar = document.querySelector(".sidebar");
    if (sidebar) {
      const rect = sidebar.getBoundingClientRect();
      sidebarWidth = Math.max(0, rect.width || 0);
    }
  }
  const margin = 24;
  const topPad = 72;
  if (isMobile) {
    panel.style.left = "0";
    panel.style.right = "0";
    panel.style.top = "0";
    panel.style.bottom = "0";
    panel.style.width = "auto";
    panel.style.borderRadius = "0";
    panel.style.padding = "0.75rem";
    if (body)
      body.style.gridTemplateColumns = "repeat(auto-fill,minmax(100px,1fr))";
  } else {
    const available = window.innerWidth - sidebarWidth - margin * 2;
    const maxWidth = Math.min(900, Math.max(560, available));
    panel.style.top = `${topPad}px`;
    panel.style.bottom = `${margin}px`;
    panel.style.right = `${margin}px`;
    panel.style.left = "auto";
    panel.style.width = `${maxWidth}px`;
    panel.style.borderRadius = "0.5rem";
    panel.style.padding = "1rem";
    if (body)
      body.style.gridTemplateColumns = "repeat(auto-fill,minmax(140px,1fr))";
  }
}

window.addEventListener("resize", () => {
  try {
    updateConversationMediaLayout();
  } catch {}
});

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sendChatMessage() {
  const input = document.getElementById("chatInput");
  const message = input.value.trim();
  if ((!message && pendingAttachments.length === 0) || !currentChatContact)
    return;

  if (!chatMessagesCache[currentChatContact])
    chatMessagesCache[currentChatContact] = [];
  const tmpId = `tmp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const attachmentsMeta = pendingAttachments.map((a) => ({
    url: a.url,
    filename: a.filename,
  }));
  const optimistic = {
    id: tmpId,
    text: message,
    sent: true,
    time: "Just now",
    attachments: attachmentsMeta,
  };
  chatMessagesCache[currentChatContact].push(optimistic);
  input.value = "";
  autoResizeTextarea(input);

  const contact = chatContacts.find((c) => c.id === currentChatContact);
  renderChatMain(contact);
  scrollChatToBottom();

  fetch(`${API_BASE}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwtToken}`,
    },
    credentials: "include",
    body: JSON.stringify({
      sender_user_id: currentUser.user_id,
      recipient_user_id: currentChatContact,
      message: message || "",
      attachments: attachmentsMeta,
      tmpId,
    }),
  })
    .then((r) => r.json())
    .then((res) => {
      if (res && res.data) {
        const idx = chatMessagesCache[currentChatContact].findIndex(
          (m) => m.id === tmpId
        );
        if (idx >= 0)
          chatMessagesCache[currentChatContact][idx] = {
            id: res.data.message_id || res.data.id,
            text: res.data.message || message,
            sent: true,
            time: formatTime(res.data.created_at || res.data.createdAt),
            attachments: Array.isArray(res.data.attachments)
              ? res.data.attachments
              : attachmentsMeta,
          };

        pendingAttachments = [];
        const preview = document.getElementById("attachmentsPreview");
        if (preview) {
          preview.innerHTML = "";
          preview.style.display = "none";
        }
        renderChatMain(contact);
        scrollChatToBottom();
        updateSendButtonState();
      }
    })
    .catch((err) => {
      console.error("Send message failed", err);
      showNotification("Failed to send message", "error");
    });
}

function scrollChatToBottom() {
  requestAnimationFrame(() => {
    const messagesContainer = document.getElementById("chatMessages");
    if (messagesContainer)
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

function attachChatInputWrapperFocus() {
  const wrap = document.getElementById("chatInputWrapper");
  const ta = document.getElementById("chatInput");
  if (!wrap || !ta) return;
  const focusIfWrapper = (e) => {
    const t = e.target;
    if (
      t.closest("button") ||
      t.tagName === "TEXTAREA" ||
      t.tagName === "INPUT" ||
      t.closest("#emojiPicker")
    )
      return;
    ta.focus();
  };

  wrap.addEventListener("mousedown", focusIfWrapper);
  wrap.addEventListener("click", focusIfWrapper);
}

async function loadMessagesForContact(contactId) {
  if (!currentUser || !currentUser.user_id) return;
  const other = contactId;
  const conversationId = [String(currentUser.user_id), String(other)]
    .sort()
    .join("_");
  try {
    const res = await fetch(
      `${API_BASE}/messages?conversationId=${encodeURIComponent(
        conversationId
      )}&sort=created_at ASC&limit=100`,
      { credentials: "include" }
    );
    const data = await res.json();
    const msgs = (data.messages || []).map((m) => ({
      id: m.message_id,
      text: m.message,
      sent: String(m.sender_user_id) === String(currentUser.user_id),
      time: formatTime(m.created_at),
      attachments: Array.isArray(m.attachments) ? m.attachments : [],
    }));
    chatMessagesCache[contactId] = msgs;
  } catch (e) {
    console.error("Failed to load messages", e);
    chatMessagesCache[contactId] = chatMessagesCache[contactId] || [];
  }
}

function handleChatKeyDown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendChatMessage();
  }
}

function autoResizeTextarea(textarea) {
  textarea.style.height = "auto";
  const isMobile = window.innerWidth <= 768;
  const cap = isMobile ? 64 : 120;
  textarea.style.height = Math.min(textarea.scrollHeight, cap) + "px";
}

function focusChatInput(textarea) {
  textarea.parentElement.style.borderColor = "var(--primary-color)";
  textarea.parentElement.style.boxShadow =
    "0 0 0 0.1875rem rgba(99, 102, 241, 0.1)";
}

function blurChatInput(textarea) {
  textarea.parentElement.style.borderColor = "var(--border-color)";
  textarea.parentElement.style.boxShadow = "none";
}

function handleImageUpload(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  const form = new FormData();
  files.forEach((f) => form.append("attachments", f));

  showUploadingState();
  fetch(`${API_BASE}/messages/upload-attachments`, {
    method: "POST",
    credentials: "include",
    headers: { Authorization: `Bearer ${jwtToken}` },
    body: form,
  })
    .then((r) => r.json())
    .then((res) => {
      if (res && res.attachments) {
        pendingAttachments = pendingAttachments.concat(
          res.attachments.map((a) => ({
            url: a.url,
            filename: a.filename,
            mimetype: a.mimetype,
            size: a.size,
          }))
        );
        renderAttachmentsPreview();
      } else {
        showNotification("Failed to attach files", "error");
      }
    })
    .catch((err) => {
      console.error(err);
      showNotification("Failed to attach files", "error");
    })
    .finally(() => hideUploadingState());
}

function renderAttachmentsPreview() {
  const el = document.getElementById("attachmentsPreview");
  if (!el) return;
  if (!pendingAttachments.length) {
    el.innerHTML = "";
    el.style.display = "none";
    return;
  }
  el.style.display = "flex";
  el.innerHTML = pendingAttachments
    .map((a, idx) => {
      const isImg = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(
        a.filename || a.url
      );
      if (isImg) {
        return `
                <div style="display:flex; align-items:center; gap:0.5rem; background: var(--background-white); border:1px solid var(--border-color); border-radius:0.5rem; padding:0.25rem;">
                    <img src="${a.url}" alt="${escapeHtml(
          a.filename || "image"
        )}" style="width:48px;height:48px;object-fit:cover;border-radius:0.375rem;border:1px solid var(--border-color)"/>
                    <div style="display:flex; flex-direction:column; max-width:12rem;">
                        <span style="font-size:0.8rem; color: var(--text-secondary); overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(
                          a.filename || "Image"
                        )}</span>
                        <span style="font-size:0.7rem; color: var(--text-muted);">${formatFileSize(
                          a.size
                        )}</span>
                    </div>
                    <button type="button" style="border:none;background:none;color: var(--error-color); cursor:pointer" onclick="removeAttachment(${idx})"><i class="fas fa-times"></i></button>
                </div>`;
      }
      return `
            <div style="display:flex; align-items:center; gap:0.5rem; background: var(--background-light); border:1px solid var(--border-color); border-radius:0.5rem; padding:0.25rem 0.5rem;">
                <i class="fas fa-paperclip" style="color: var(--text-muted)"></i>
                <a href="${
                  a.url
                }" target="_blank" rel="noopener" style="color: var(--text-secondary); font-size: 0.8125rem; max-width: 12rem; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">${escapeHtml(
        a.filename || "Attachment"
      )}</a>
                <span style="font-size:0.7rem; color: var(--text-muted);">${formatFileSize(
                  a.size
                )}</span>
                <button type="button" style="border:none;background:none;color: var(--error-color); cursor:pointer" onclick="removeAttachment(${idx})"><i class="fas fa-times"></i></button>
            </div>`;
    })
    .join("");
}

function removeAttachment(index) {
  pendingAttachments.splice(index, 1);
  renderAttachmentsPreview();
}

function toggleEmojiPicker() {
  const picker = document.getElementById("emojiPicker");
  if (!picker) return;

  try {
    document.getElementById("imageUpload").value = "";
  } catch {}
  picker.style.display =
    picker.style.display === "none" || !picker.style.display ? "block" : "none";
}

function openAttachmentPicker() {
  const picker = document.getElementById("emojiPicker");
  if (picker) picker.style.display = "none";
  const input = document.getElementById("imageUpload");
  if (input) input.click();
}

function handleDragEnter(e) {
  e.preventDefault();
  e.stopPropagation();
  const w = document.getElementById("chatInputWrapper");
  if (w) w.style.borderColor = "var(--primary-color)";
  const hint = document.getElementById("dropHint");
  if (hint) {
    hint.style.display = "flex";
  }
}
function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
}
function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  const w = document.getElementById("chatInputWrapper");
  if (w) w.style.borderColor = "var(--border-color)";
  const hint = document.getElementById("dropHint");
  if (hint) {
    hint.style.display = "none";
  }
}
function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const w = document.getElementById("chatInputWrapper");
  if (w) w.style.borderColor = "var(--border-color)";
  const hint = document.getElementById("dropHint");
  if (hint) {
    hint.style.display = "none";
  }
  const dt = e.dataTransfer;
  const files = Array.from(dt?.files || []);
  if (!files.length) return;
  const form = new FormData();
  files.forEach((f) => form.append("attachments", f));

  showUploadingState();
  fetch(`${API_BASE}/messages/upload-attachments`, {
    method: "POST",
    credentials: "include",
    headers: { Authorization: `Bearer ${jwtToken}` },
    body: form,
  })
    .then((r) => r.json())
    .then((res) => {
      if (res && res.attachments) {
        pendingAttachments = pendingAttachments.concat(
          res.attachments.map((a) => ({
            url: a.url,
            filename: a.filename,
            mimetype: a.mimetype,
            size: a.size,
          }))
        );
        renderAttachmentsPreview();
      } else {
        showNotification("Failed to attach files", "error");
      }
    })
    .catch((err) => {
      console.error(err);
      showNotification("Failed to attach files", "error");
    })
    .finally(() => hideUploadingState());
}

function showUploadingState() {
  const el = document.getElementById("attachmentsPreview");
  if (!el) return;
  el.style.display = "flex";
  const spinner = document.createElement("div");
  spinner.id = "uploadSpinner";
  spinner.style.cssText =
    "display:flex; align-items:center; gap:0.5rem; color: var(--text-muted);";
  spinner.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading…';
  el.appendChild(spinner);
}

function hideUploadingState() {
  const spinner = document.getElementById("uploadSpinner");
  if (spinner && spinner.parentElement)
    spinner.parentElement.removeChild(spinner);
}

function formatFileSize(bytes) {
  if (!bytes) return "";
  const thresh = 1024;
  if (Math.abs(bytes) < thresh) return bytes + " B";
  const units = ["KB", "MB", "GB", "TB"];
  let u = -1;
  do {
    bytes /= thresh;
    ++u;
  } while (Math.abs(bytes) >= thresh && u < units.length - 1);
  return bytes.toFixed(1) + " " + units[u];
}

function insertEmoji(emoji) {
  const ta = document.getElementById("chatInput");
  if (!ta) return;
  const start = ta.selectionStart || 0;
  const end = ta.selectionEnd || 0;
  const value = ta.value;
  ta.value = value.slice(0, start) + emoji + value.slice(end);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = start + emoji.length;
  autoResizeTextarea(ta);
  updateSendButtonState();
}

function showTypingIndicator(isTyping) {
  const el = document.getElementById("typingIndicator");
  if (!el) return;
  el.style.display = isTyping ? "block" : "none";
}

function updateAnnouncementsBadge() {
  const urgentCount = announcements.filter((a) => a.priority === "high").length;
  const badge = document.getElementById("announcementsBadge");
  if (urgentCount > 0) {
    badge.textContent = urgentCount;
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }
}

function updateChatBadge() {
  const totalUnread = chatContacts.reduce(
    (sum, contact) => sum + contact.unreadCount,
    0
  );
  const badge = document.getElementById("chatBadge");
  if (totalUnread > 0) {
    badge.textContent = totalUnread;
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }
}

function showModal(modalId) {
  try {
    if (modalId === 'newMessageModal') {
      const m = document.getElementById(modalId);
      if (m) {
        m.classList.add('show');
        m.classList.add('active');
        try { (m.querySelector('textarea') || m.querySelector('input'))?.focus(); } catch(e){}
      }
      return;
    }

    if (typeof Modal !== 'undefined' && Modal && typeof Modal.open === 'function' && document.getElementById('globalModal')) {
      const src = document.getElementById(modalId);
      if (!src) return;

      const titleEl = src.querySelector('.modal-title') || src.querySelector('h1, h2, h3, h4');
      const titleText = titleEl ? (titleEl.textContent || titleEl.innerText || '') : '';

      const clone = src.cloneNode(true);

      const rem = clone.querySelectorAll('.modal-header, h1, h2, h3, .modal-title');
      rem.forEach(n => n.parentNode && n.parentNode.removeChild(n));
      const bodyHtml = clone.innerHTML;
      Modal.open({ title: titleText || modalId, body: bodyHtml, showFooter: false });
      return;
    }
  } catch (e) {
    console.warn('showModal via Modal failed, falling back to DOM show', e);
  }
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('show');
}

function closeModal(modalId) {
  try {
    // If the modal is the page-local new message modal, close it directly.
    if (modalId === 'newMessageModal') {
      const m = document.getElementById(modalId);
      if (m) {
        m.classList.remove('show');
        m.classList.remove('active');
      }
      return;
    }

    if (typeof Modal !== 'undefined' && Modal && typeof Modal.close === 'function' && document.getElementById('globalModal')) {
      Modal.close();
      return;
    }
  } catch (e) {
    console.warn('closeModal via Modal failed, falling back', e);
  }
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('show');
}

document.addEventListener("click", function (e) {
  if (e.target.classList.contains("modal-overlay")) {
    e.target.classList.remove("show");
    e.target.classList.remove("active");
  }
});

function setupEventListeners() {
  const announcementSearch = document.getElementById("announcementSearch");
  if (announcementSearch) {
    announcementSearch.addEventListener("input", function (e) {});
  }

  const chatSearchInput = document.getElementById("chatSearchInput");
  if (chatSearchInput) {
    chatSearchInput.addEventListener("input", function (e) {
      const q = (e.target.value || "").trim();
      
      clearTimeout(chatSearchDebounce);
      chatSearchDebounce = setTimeout(() => {
        searchChatContacts(q);
      }, 250);
    });
  }

  
  const recipientSearchInput = document.getElementById("recipientSearch");
  if (recipientSearchInput) {
    let recipientDebounce = null;
    recipientSearchInput.addEventListener("input", function (e) {
      const q = (e.target.value || "").trim();
      if (recipientDebounce) clearTimeout(recipientDebounce);
      recipientDebounce = setTimeout(() => {
        try {
          searchRecipients(q);
        } catch (err) {
          console.error("recipient search failed", err);
        }
      }, 300);
    });
  }

  document.addEventListener("input", function (e) {
    if (
      e.target &&
      e.target.id === "chatInput" &&
      socket &&
      currentUser &&
      currentChatContact
    ) {
      socket.emit("typing_start", { otherUserId: currentChatContact });
      clearTimeout(typingTimeouts[currentChatContact]);
      typingTimeouts[currentChatContact] = setTimeout(() => {
        socket.emit("typing_stop", { otherUserId: currentChatContact });
      }, 1200);
    }
    if (e.target && e.target.id === "chatInput") {
      updateSendButtonState();
    }
  });
}

function updateSendButtonState() {
  const btn = document.getElementById("sendBtn");
  const ta = document.getElementById("chatInput");
  if (!btn || !ta) return;
  const hasText = (ta.value || "").trim().length > 0;
  const hasFiles = pendingAttachments.length > 0;
  btn.disabled = !(hasText || hasFiles);
  btn.style.opacity = btn.disabled ? 0.7 : 1;
}

function showNotification(message, type = "success") {
  try {
    if (typeof window !== 'undefined' && typeof window.showAlert === 'function') {
      
      window.showAlert(String(message || ''), type === 'error' ? 'error' : type === 'info' ? 'info' : 'success');
      return;
    }
  } catch (e) {
    console.warn('showNotification via showAlert failed', e);
  }

  
  const notification = document.createElement("div");
  notification.className = "notification";
  notification.textContent = message;

  if (type === "error") {
    notification.style.background =
      "linear-gradient(135deg, var(--error-color), #dc2626)";
  } else if (type === "info") {
    notification.style.background =
      "linear-gradient(135deg, var(--secondary-color), #0891b2)";
  }

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideOutRight 0.5s ease forwards";
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

const style = document.createElement("style");
style.textContent = `
    @keyframes slideOutRight {
        to {
            transform: translateX(120%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

function getInitials(first, last) {
  const a = (first || "").trim()[0] || "";
  const b = (last || "").trim()[0] || "";
  const s = (a + b).toUpperCase();
  return s || "U";
}
function getInitialsFromName(name) {
  const parts = (name || "").trim().split(/\s+/);
  if (parts.length === 0) return "U";
  const a = parts[0][0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  const s = (a + b).toUpperCase();
  return s || "U";
}


function createAvatarHtml(avatarUrl, displayName, size = 40, extraClass = "") {
  const s = size || 40;
  const initials = escapeHtml(getInitialsFromName(displayName || ""));
  if (avatarUrl) {
    const safeUrl = escapeHtml(avatarUrl);
    const safeAlt = escapeHtml(displayName || "User");
    
    return `
      <div class="contact-avatar ${extraClass}" style="width:${s}px;height:${s}px;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:50%;">
        <img src="${safeUrl}" alt="${safeAlt}" style="width:${s}px;height:${s}px;object-fit:cover;border-radius:50%;" onerror="this.onerror=null;this.closest('.contact-avatar').innerHTML='${initials}'" />
      </div>
    `;
  }
  return `
    <div class="contact-avatar ${extraClass}" style="width:${s}px;height:${s}px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--background-light);">
      ${initials}
    </div>
  `;
}

function highlightMatch(text, query) {
  if (!query) return text;
  try {
    const q = String(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(q, "ig");
    return String(text).replace(re, (m) => `<mark style="background:var(--mark-bg, #ffd54d);color:inherit;padding:0 .125rem;border-radius:0.125rem">${m}</mark>`);
  } catch (e) {
    return text;
  }
}

async function searchChatContacts(query) {
  lastChatSearchQuery = query || "";
  const container = document.getElementById("chatContacts");
  if (container) container.innerHTML = '<div style="padding:0.5rem; color: var(--text-muted);">Searching...</div>';
  try {
    if (!currentUser || !currentUser.user_id) {
      if (container) container.innerHTML = '<div style="padding:0.5rem; color: var(--text-muted);">No conversations.</div>';
      return;
    }
    const res = await fetch(`${API_BASE}/messages/conversations/${currentUser.user_id}`, { credentials: 'include' });
    const convs = await res.json();
    const mapped = (convs || []).map((c) => ({
      id: c.other_user_id,
      name: c.other_user_name || "",
      avatar: getInitialsFromName(c.other_user_name || ""),
      avatarUrl: c.other_user_avatar || null,
      online: false,
      lastMessage: c.last_message || "",
      lastTime: c.last_message_time ? formatTime(c.last_message_time) : "",
      unreadCount: 0,
    }));
    allChatContacts = mapped;
    if (query) {
      const ql = String(query).toLowerCase();
      chatContacts = mapped.filter((c) => {
        const name = (c.name || '').toLowerCase();
        const last = (c.lastMessage || '').toLowerCase();
        return name.includes(ql) || last.includes(ql);
      });
    } else {
      chatContacts = mapped;
    }
    if (!chatContacts.length) {
      if (container) container.innerHTML = '<div style="padding:0.5rem; color: var(--text-muted);">No conversations found.</div>';
      return;
    }
    renderChatContacts();
  } catch (err) {
    console.error('searchChatContacts failed', err);
    if (container) container.innerHTML = '<div style="padding:0.5rem; color: var(--text-muted);">Failed to load conversations.</div>';
  }
}

let selectedRecipient = null;
function openNewMessageModal() {
  selectedRecipient = null;
  const results = document.getElementById("recipientResults");
  if (results) results.innerHTML = "";
  const input = document.getElementById("recipientSearch");
  if (input) input.value = "";
  const msg = document.getElementById("newMessageText");
  if (msg) msg.value = "";
  
  try {
    
    searchRecipients("");
  } catch (e) {}
  showModal("newMessageModal");
}

async function searchRecipients(query) {
  const results = document.getElementById("recipientResults");
  if (!results) return;
  results.innerHTML =
    '<div style="padding:0.5rem; color: var(--text-muted);">Searching...</div>';
  try {
    
    const url = `${API_BASE}/users?role=TENANT&limit=50${
      query ? `&search=${encodeURIComponent(query)}` : ""
    }`;
    const res = await fetch(url, { credentials: "include" });
    const data = await res.json();
    const users = data.users || [];
    if (users.length === 0) {
      results.innerHTML =
        '<div style="padding:0.5rem; color: var(--text-muted);">No tenants found.</div>';
      return;
    }
    results.innerHTML = users
      .map((u) => {
        const avatarUrl = u.avatar || u.avatarUrl || u.profile_image || u.photo || "";
        const safeFirst = (u.first_name || "").replace(/'/g, "\\'");
        const safeLast = (u.last_name || "").replace(/'/g, "\\'");
        const displayName = `${u.first_name || ""} ${u.last_name || ""}`.trim();
        const nameEsc = escapeHtml(displayName);
        const emailEsc = escapeHtml(u.email || "");
        const avatarHtml = createAvatarHtml(avatarUrl, displayName, 40);

        return `
            <div class="contact-item" style="cursor:pointer" onclick="selectRecipient('${u.user_id}', '${safeFirst}', '${safeLast}')">
                ${avatarHtml}
                <div class="contact-info">
                    <div class="contact-name">${nameEsc}</div>
                    <div class="contact-last-message" style="color: var(--text-muted); font-size: 0.8125rem">${emailEsc}</div>
                </div>
            </div>
        `;
      })
      .join("");
    // We've populated the recipient results for the New Message modal.
    // No need to mutate chatContacts here — stop after rendering the results.
    return;
  } catch (err) {
    console.error("Chat contact search failed", err);
  }
}

function selectRecipient(userId, firstName, lastName) {
  selectedRecipient = String(userId);
  const input = document.getElementById("recipientSearch");
  if (input) input.value = `${firstName} ${lastName}`.trim();
}

async function sendFirstMessage() {
  const message = (
    document.getElementById("newMessageText")?.value || ""
  ).trim();
  if (!selectedRecipient) {
    showNotification("Please select a recipient", "error");
    return;
  }
  if (!message) {
    showNotification("Please type a message", "error");
    return;
  }
  try {
    const resp = await fetch(`${API_BASE}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
      },
      credentials: "include",
      body: JSON.stringify({
        sender_user_id: currentUser.user_id,
        recipient_user_id: selectedRecipient,
        message,
      }),
    });
    const data = await resp.json();
    if (resp.ok && data && data.data) {
      closeModal("newMessageModal");

      await loadConversationsOnly();
      renderChatContacts();
      selectChatContact(selectedRecipient);
    } else {
      showNotification(data.message || "Failed to send message", "error");
    }
  } catch (e) {
    console.error(e);
    showNotification("Failed to send message", "error");
  }
}


function openChatSidebarMobile() {
  try {
    const sb = document.getElementById("chatSidebar");
    const ov = document.getElementById("chatSidebarOverlay");
    if (sb) sb.classList.add("show");
    if (ov) {
      ov.classList.add("show");
      ov.onclick = closeChatSidebarMobile;
    }
    document.body.style.overflow = "hidden";
  } catch {}
}
function closeChatSidebarMobile() {
  try {
    const sb = document.getElementById("chatSidebar");
    const ov = document.getElementById("chatSidebarOverlay");
    if (sb) sb.classList.remove("show");
    if (ov) {
      ov.classList.remove("show");
      ov.onclick = null;
    }
    document.body.style.overflow = "";
  } catch {}
}



async function globalLogout() {
  try {
    
    await ensureModalHelpers(1500);
  } catch (e) {}

  const confirmWithOverlay = () =>
    new Promise((resolve) => {
      try {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.classList.add('active');
        overlay.style.zIndex = 12000;

        const container = document.createElement('div');
        container.className = 'modal-container';

        const header = document.createElement('div');
        header.className = 'modal-header';
        const titleEl = document.createElement('div');
        titleEl.className = 'modal-title';
        const titleText = document.createElement('span');
        titleText.className = 'modal-title-text';
        titleText.textContent = 'Sign out';
        titleEl.appendChild(titleText);
        header.appendChild(titleEl);

        const body = document.createElement('div');
        body.className = 'modal-body';
        body.style.padding = '16px 22px';
        body.textContent = 'Are you sure you want to sign out?';

        const footer = document.createElement('div');
        footer.className = 'modal-footer';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-cancel';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = function () {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          resolve(false);
        };

        const okBtn = document.createElement('button');
        okBtn.className = 'btn-confirm';
        okBtn.textContent = 'OK';
        okBtn.onclick = function () {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          resolve(true);
        };

        footer.appendChild(cancelBtn);
        footer.appendChild(okBtn);
        container.appendChild(header);
        container.appendChild(body);
        container.appendChild(footer);
        overlay.appendChild(container);
        (document.body || document.documentElement).appendChild(overlay);
        setTimeout(function () {
          try { okBtn.focus(); } catch (e) {}
        }, 20);
      } catch (e) {
        try { resolve(confirm('Are you sure you want to sign out?')); } catch (_) { resolve(false); }
      }
    });

  let ok = false;
  try {
    if (typeof window.showConfirm === 'function') {
      ok = !!(await window.showConfirm('Are you sure you want to sign out?', 'Sign out'));
    } else {
      ok = !!(await confirmWithOverlay());
    }
  } catch (e) {
    ok = !!window.confirm?.('Are you sure you want to sign out?');
  }
  if (!ok) return;

  try { localStorage.clear(); } catch (e) {}
  try { sessionStorage.clear(); } catch (e) {}
  try {
    fetch('/api/v1/users/logout', { method: 'POST', credentials: 'include' })
      .finally(() => { window.location.href = '/login.html'; });
  } catch (e) {
    window.location.href = '/login.html';
  }
}

window.openNewMessageModal = openNewMessageModal;
window.searchRecipients = searchRecipients;
window.selectRecipient = selectRecipient;
window.sendFirstMessage = sendFirstMessage;
window.switchTab = switchTab;
window.setAnnouncementFilter = setAnnouncementFilter;
window.openCreateAnnouncementModal = openCreateAnnouncementModal;
window.createAnnouncement = createAnnouncement;
window.viewAnnouncement = viewAnnouncement;
window.goToPage = goToPage;
window.changeAnnouncementsPerPage = changeAnnouncementsPerPage;
window.selectChatContact = selectChatContact;
window.autoResizeTextarea = autoResizeTextarea;
window.handleChatKeyDown = handleChatKeyDown;
window.handleImageUpload = handleImageUpload;
window.sendChatMessage = sendChatMessage;
window.removeAttachment = removeAttachment;
window.toggleEmojiPicker = toggleEmojiPicker;
window.insertEmoji = insertEmoji;
window.openAttachmentPicker = openAttachmentPicker;
window.handleDragEnter = handleDragEnter;
window.handleDragOver = handleDragOver;
window.handleDragLeave = handleDragLeave;
window.handleDrop = handleDrop;
window.focusChatInput = focusChatInput;
window.blurChatInput = blurChatInput;
window.openImageModal = openImageModal;
window.openConversationMedia = openConversationMedia;
window.closeConversationMedia = closeConversationMedia;
window.stepImage = stepImage;
window.closeImageModal = closeImageModal;
window.switchConvMediaTab = switchConvMediaTab;
window.openChatSidebarMobile = openChatSidebarMobile;
window.closeChatSidebarMobile = closeChatSidebarMobile;
window.closeModal = closeModal;

window.logout = globalLogout;