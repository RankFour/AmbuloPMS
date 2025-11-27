(function () {
    const API_BASE_URL = "/api/v1/properties";
    const WL_API = "/api/v1/wishlist";

    function getWishlist() {
        try {
            return JSON.parse(localStorage.getItem("wishlist") || "[]");
        } catch {
            return [];
        }
    }
    function setWishlist(list) {
        try {
            localStorage.setItem(
                "wishlist",
                JSON.stringify(Array.from(new Set(list)))
            );
        } catch { }
    }
    function isWishlisted(id) {
        return getWishlist().includes(String(id));
    }
    async function toggleWishlist(id) {
        const l = getWishlist();
        const s = String(id);
        const i = l.indexOf(s);
        if (i >= 0) {
            l.splice(i, 1);
            setWishlist(l);
            try { await fetch(`${WL_API}/${encodeURIComponent(s)}`, { method: 'DELETE', credentials: 'include' }); } catch {}
        } else {
            l.push(s);
            setWishlist(l);
            try {
                await fetch(WL_API, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ property_id: s })
                });
            } catch {}
        }
        try { window.dispatchEvent(new Event('wishlist:updated')); } catch { }
    }

    function wishlistIconSvg(active) {
        return active
            ? '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="#e11d48"><path d="M11.645 20.91l-.007-.007C5.4 15.43 2 12.36 2 8.5 2 6.015 4.014 4 6.5 4c1.74 0 3.41 1.01 4.145 2.57C12.09 5.01 13.76 4 15.5 4 18.486 4 20.5 6.015 20.5 8.5c0 3.86-3.4 6.93-9.138 12.403l-.007.007a1 1 0 01-1.41 0z"/></svg>'
            : '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="#e11d48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6.01 4.01 4 6.5 4c1.74 0 3.41 1.01 4.5 2.09C12.09 5.01 13.76 4 15.5 4 17.99 4 20 6.01 20 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
    }

    function formatPrice(price) {
        return price ? `₱ ${Number(price).toLocaleString()}` : "N/A";
    }
    function formatArea(area) {
        return area ? `${Number(area).toLocaleString()} sqm` : "N/A";
    }
    function getStatusBadge(status) {
        const s = String(status || "").toLowerCase();
        if (s === "available")
            return '<div class="status-badge status-available">Available</div>';
        if (s === "occupied")
            return '<div class="status-badge status-occupied">Occupied</div>';
        if (s === "reserved")
            return '<div class="status-badge status-reserved">Reserved</div>';
        if (s === "maintenance")
            return '<div class="status-badge status-maintenance">Maintenance</div>';
        return "";
    }

    async function fetchAll() {
        try {
            const cacheKey = "propertySpacesAll";
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                try {
                    return JSON.parse(cached);
                } catch {
                    sessionStorage.removeItem(cacheKey);
                }
            }
            const res = await fetch(`${API_BASE_URL}?limit=200`, {
                credentials: "include",
                headers: { Accept: "application/json" },
            });
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            const normalized = Array.isArray(data)
                ? { properties: data }
                : data && Array.isArray(data.properties)
                    ? data
                    : data && Array.isArray(data.data)
                        ? { properties: data.data }
                        : { properties: [] };
            sessionStorage.setItem(cacheKey, JSON.stringify(normalized));
            return normalized;
        } catch (e) {
            console.error("wishlist fetch error", e);
            return { properties: [] };
        }
    }

    async function fetchSingle(id) {
        try {
            const res = await fetch(`${API_BASE_URL}/${encodeURIComponent(id)}`, {
                credentials: "include",
                headers: { Accept: "application/json" },
            });
            if (!res.ok) throw new Error("Failed single fetch");
            const data = await res.json();
            if (data && data.property) return data.property;
            return null;
        } catch (e) {
            console.warn("single property fetch failed", id, e.message);
            return null;
        }
    }

    async function fetchWishlistProperties(list) {
        if (!Array.isArray(list) || list.length === 0) return [];

        const bulk = await fetchAll();
        const props = bulk && Array.isArray(bulk.properties) ? bulk.properties : [];
        const map = new Map(props.map((p) => [String(p.property_id), p]));
        const result = [];
        const missing = [];
        list.forEach((id) => {
            const hit = map.get(String(id));
            if (hit) result.push(hit);
            else missing.push(id);
        });
        if (missing.length) {
            const singles = await Promise.all(missing.map((m) => fetchSingle(m)));
            singles.filter(Boolean).forEach((p) => result.push(p));
        }
        return result;
    }

    function showToast(message, type = "info") {
        try {
            let container = document.getElementById("toast-container");
            if (!container) {
                container = document.createElement("div");
                container.id = "toast-container";
                container.style.position = "fixed";
                container.style.top = "20px";
                container.style.right = "20px";
                container.style.zIndex = 10000;
                container.style.display = "flex";
                container.style.flexDirection = "column";
                container.style.gap = "10px";
                document.body.appendChild(container);
            }
            const toast = document.createElement("div");
            toast.style.padding = "10px 14px";
            toast.style.borderRadius = "10px";
            toast.style.color = "#fff";
            toast.style.fontWeight = "600";
            toast.style.boxShadow = "0 8px 30px rgba(0,0,0,0.12)";
            toast.style.maxWidth = "320px";
            toast.style.opacity = "0";
            toast.style.transform = "translateX(12px)";
            toast.style.transition = "transform 220ms ease, opacity 220ms ease";
            if (type === "success")
                toast.style.background = "linear-gradient(135deg,#10b981,#059669)";
            else if (type === "error")
                toast.style.background = "linear-gradient(135deg,#ef4444,#dc2626)";
            else toast.style.background = "linear-gradient(135deg,#3b82f6,#1d4ed8)";
            toast.textContent = String(message || "");
            container.appendChild(toast);
            requestAnimationFrame(() => {
                toast.style.opacity = "1";
                toast.style.transform = "translateX(0)";
            });
            setTimeout(() => {
                toast.style.opacity = "0";
                toast.style.transform = "translateX(12px)";
                setTimeout(() => {
                    try {
                        toast.remove();
                    } catch { }
                }, 280);
            }, 2000);
        } catch { }
    }

    function renderCard(p) {
        const pid =
            p.property_id != null
                ? p.property_id
                : p.id != null
                    ? p.id
                    : p.space_id != null
                        ? p.space_id
                        : "";
        const wished = isWishlisted(pid);
        const imageUrl =
            p.display_image ||
            (p.property_pictures &&
                p.property_pictures[0] &&
                p.property_pictures[0].image_url) ||
            p.image_url ||
            "/assets/default-property.jpg";
        const address = p.street
            ? `${p.street}, ${p.city || ""}, ${p.province || ""}`
            : p.city || p.location || "";
        const statusLower = String(
            p.property_status || p.status || ""
        ).toLowerCase();
        return `
      <div class="property-card reveal-element scale-up" data-status="${statusLower}" data-price="${p.base_rent || p.price || 0
            }" data-area="${p.floor_area_sqm || p.area_sqm || 0}" data-id="${pid}">
        <div class="property-image" style="background-image:url('${imageUrl}');">
          ${getStatusBadge(p.property_status || p.status)}
          <button class="wishlist-btn" aria-label="Remove from wishlist" data-id="${pid}">${wishlistIconSvg(
                wished
            )}</button>
        </div>
        <div class="property-info">
          <div class="property-header">
            <div>
              <div class="property-title">${p.property_name || p.name || "Unit"
            }</div>
              <div class="property-desc">${address}</div>
              <div class="property-price"><span class="price-amount">${formatPrice(
                p.base_rent || p.price
            )}</span><span class="price-term">/mo</span></div>
            </div>
          </div>
          <div class="property-details">
            <div class="detail-item"><div class="detail-icon"><i class="fa-solid fa-ruler-combined"></i></div><span>${formatArea(
                p.floor_area_sqm
            )}</span></div>
            <div class="detail-item"><div class="detail-icon"><i class="fa-solid fa-building"></i></div><span>${p.building_name || ""
            }</span></div>
            <div class="detail-item"><div class="detail-icon"><i class="fa-solid fa-map-marker-alt"></i></div><span>${p.barangay || ""
            }</span></div>
          </div>
          <div class="property-actions">
            <button class="btn btn-primary" onclick="window.location.href='spacesDetails.html?id=${pid}'">View Details</button>
          </div>
        </div>
      </div>`;
    }

    function bindWishlistButtons() {
        document.querySelectorAll(".wishlist-btn").forEach((btn) => {
            btn.style.display = "inline-flex";
            btn.style.alignItems = "center";
            btn.style.justifyContent = "center";
            const svg = btn.querySelector("svg");
            if (svg) svg.style.display = "block";
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = btn.getAttribute("data-id");
                const before = isWishlisted(id);
                toggleWishlist(id);
                const after = isWishlisted(id);
                btn.innerHTML = wishlistIconSvg(after);
                btn.classList.toggle("active", after);
                showToast(
                    after ? "Added to wishlist" : "Removed from wishlist",
                    after ? "success" : "info"
                );
                if (before && !after) {
                    const card = btn.closest(".property-card");
                    if (card && card.parentNode) card.parentNode.removeChild(card);
                    updateSummary();
                    maybeShowEmpty();
                }

                updateSummary();
            });
        });
    }

    function updateSummary() {
        const count = document.querySelectorAll(
            "#wishlistGrid .property-card"
        ).length;
        const el = document.getElementById("wishlistSummary");
        if (el)
            el.textContent = `You have ${count} wishlisted propert${count === 1 ? "y" : "ies"
                }.`;

        const badge = document.getElementById("wishlistCountBadge");
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? "inline-flex" : "none";
        }
    }
    function maybeShowEmpty() {
        const grid = document.getElementById("wishlistGrid");
        const empty = document.getElementById("noWishlist");
        const has = grid && grid.children.length > 0;
        if (empty) empty.style.display = has ? "none" : "";
    }

    async function init() {
        const grid = document.getElementById("wishlistGrid");
        let list = getWishlist();
        if (!list || list.length === 0) {
            
            try {
                const res = await fetch(WL_API, { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    const ids = (data && (data.wishlist || data.ids)) || [];
                    if (Array.isArray(ids) && ids.length) {
                        setWishlist(ids);
                        list = ids;
                        try { window.dispatchEvent(new Event('wishlist:updated')); } catch {}
                    }
                }
            } catch {}
        }
        if (!list || list.length === 0) {
            document.getElementById("wishlistSummary").textContent =
                "You have 0 wishlisted properties.";
            document.getElementById("noWishlist").style.display = "";
            return;
        }
        document.getElementById("noWishlist").style.display = "none";

        const fetched = await fetchWishlistProperties(list);
        grid.innerHTML = fetched.map(renderCard).join("");

        grid.querySelectorAll(".property-card, .reveal-element").forEach((el) => {
            el.classList.add("revealed");
        });
        bindWishlistButtons();
        updateSummary();
        try { await initSuggestions(list); } catch (e) { console.warn('suggestions init failed', e); }
    }

    if (document.readyState === "loading")
        document.addEventListener("DOMContentLoaded", init);
    else init();

    
    async function initSuggestions(wishlistIds) {
        const section = document.getElementById('suggestionsSection');
        const container = document.getElementById('suggestionsContainer');
        const listEl = document.getElementById('suggestionsList');
        if (!section || !listEl || !container) return;
        const all = await fetchAll();
        const props = (all && all.properties) || [];
        const wlSet = new Set((wishlistIds || []).map(String));
        const pool = props.filter(p => {
            const pid = String(p.property_id != null ? p.property_id : (p.id != null ? p.id : (p.space_id != null ? p.space_id : '')));
            if (!pid || wlSet.has(pid)) return false;
            const status = String(p.property_status || p.status || '').toLowerCase();
            return status === 'available';
        });
        if (!pool.length) return;
        
        const dateKey = getLocalDateKey();
        pool.sort((a, b) => dailyHash(getId(a) + '|' + dateKey) - dailyHash(getId(b) + '|' + dateKey));
        const suggestions = pool.slice(0, 3);
        listEl.innerHTML = suggestions.map(renderSuggestionCard).join('');
        container.style.display = '';
        bindSuggestionWishlistButtons(listEl);
        syncSuggestionsHeight();
        window.addEventListener('resize', debounce(syncSuggestionsHeight, 150));
    }

    function getId(p){
        return String(p.property_id != null ? p.property_id : (p.id != null ? p.id : (p.space_id != null ? p.space_id : '')));
    }

    function getLocalDateKey(){
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth()+1).padStart(2,'0');
        const day = String(d.getDate()).padStart(2,'0');
        return `${y}-${m}-${day}`;
    }

    function dailyHash(str){
        let h = 5381;
        for (let i=0;i<str.length;i++){
            h = ((h << 5) + h) ^ str.charCodeAt(i);
        }
        return h >>> 0; 
    }

    function syncSuggestionsHeight() {
        const wrapper = document.querySelector('.wishlist-page-wrapper');
        const container = document.getElementById('suggestionsContainer');
        if (!wrapper || !container) return;
        container.style.minHeight = wrapper.offsetHeight + 'px';
    }

    function debounce(fn, wait) {
        let t; return function(...args){ clearTimeout(t); t = setTimeout(()=>fn.apply(this,args), wait); };
    }

    function renderSuggestionCard(p) {
        const pid = p.property_id != null ? p.property_id : (p.id != null ? p.id : (p.space_id != null ? p.space_id : ''));
        const imageUrl = p.display_image || (p.property_pictures && p.property_pictures[0] && p.property_pictures[0].image_url) || p.image_url || '/assets/default-property.jpg';
        const price = formatPrice(p.base_rent || p.price);
        const area = formatArea(p.floor_area_sqm || p.area_sqm);
        const wished = isWishlisted(pid);
        return `<div class="suggestion-card" data-id="${pid}">
            <div class="suggestion-image" style="background-image:url('${imageUrl}');">
                <button class="suggest-wishlist-btn" data-id="${pid}" aria-label="${wished ? 'Remove from wishlist' : 'Add to wishlist'}">${wishlistIconSvg(wished)}</button>
            </div>
            <div class="suggest-body">
                <div class="suggest-title">${p.property_name || p.name || 'Property'}</div>
                <div class="suggest-meta">
                    <span><i class="fa-solid fa-ruler-combined"></i>${area}</span>
                    <span><i class="fa-solid fa-coins"></i>${price}/mo</span>
                </div>
                <button class="btn btn-primary suggest-view-btn" onclick="window.location.href='spacesDetails.html?id=${pid}'">View Details</button>
            </div>
        </div>`;
    }

    

    function bindSuggestionWishlistButtons(root) {
        root.querySelectorAll('.suggest-wishlist-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.preventDefault(); e.stopPropagation();
                const id = btn.getAttribute('data-id');
                const before = isWishlisted(id);
                toggleWishlist(id);
                const after = isWishlisted(id);
                btn.innerHTML = wishlistIconSvg(after);
                btn.classList.toggle('active', after);
                showToast(after ? 'Added to wishlist' : 'Removed from wishlist', after ? 'success' : 'info');
            });
        });
    }
})();
