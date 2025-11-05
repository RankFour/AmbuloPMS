(function () {
    try {

        var path = (location.pathname || '').toLowerCase();
        function isPublicPage() {
            try {
                var publicPaths = new Set([
                    '/', '/index.html', '/login.html', '/aboutus.html', '/contactus.html', '/propertyspaces.html', '/spacesdetails.html'
                ]);
                return publicPaths.has(path);
            } catch (_) { return false; }
        }
        var PUBLIC_MODE = isPublicPage();
        if (PUBLIC_MODE) {
            try { window.PageLoader = { hide: function () { }, show: function () { } }; } catch (_) { }
            return;
        }


        var css = `
    #page-loader{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;
      background: radial-gradient(1200px 800px at 10% 10%, #eef2ff 0%, rgba(248,250,252,0.95) 40%, rgba(248,250,252,0.96) 100%);
      -webkit-backdrop-filter:saturate(180%) blur(6px);backdrop-filter:saturate(180%) blur(6px);
      transition:opacity .35s ease, visibility .35s ease; font-family:"Poppins", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif}
    #page-loader.hide{opacity:0;visibility:hidden}
    #page-loader .pl-inner{display:flex;flex-direction:column;align-items:center;gap:14px;color:#0f172a;text-align:center}
    #page-loader .spinner{width:76px;height:76px;position:relative;display:flex;align-items:center;justify-content:center;border-radius:50%}
    #page-loader .spinner .track{position:absolute;inset:0;border-radius:50%;border:4px solid #e2e8f0;opacity:.8}
    #page-loader .spinner .arc{position:absolute;inset:0;border-radius:50%;
      background:conic-gradient(from 0turn, #3b82f6 0 24%, transparent 24% 100%);
      -webkit-mask:radial-gradient(farthest-side, transparent calc(50% - 6px), #000 0);
              mask:radial-gradient(farthest-side, transparent calc(50% - 6px), #000 0);
      animation:pl-rotate 1.05s linear infinite;opacity:.95}
    #page-loader .spinner .logo-in{position:relative;z-index:1;display:block;max-width:60px;max-height:60px;object-fit:contain;filter:drop-shadow(0 1px 1px rgba(0,0,0,.06))}
    #page-loader .brand{font-weight:700;letter-spacing:.2px;color:#1e293b}
    #page-loader .muted{font-size:.9rem;color:#64748b}
    #page-loader .group{display:flex;flex-direction:column;align-items:center;gap:10px}
    #page-loader .fade-up{animation:pl-fade-up .5s ease both}
    @keyframes pl-rotate{to{transform:rotate(360deg)}}
    @keyframes pl-fade-up{from{opacity:0;transform:translate3d(0,6px,0)}to{opacity:1;transform:translate3d(0,0,0)}}
    @media (prefers-reduced-motion: reduce){
      #page-loader,#page-loader *{animation:none!important;transition:none!important}
    }
    `;
        var style = document.createElement('style');
        style.id = 'page-loader-style';
        style.type = 'text/css';
        style.appendChild(document.createTextNode(css));
        (document.head || document.documentElement).appendChild(style);


        var overlay = document.createElement('div');
        overlay.id = 'page-loader';
        overlay.innerHTML = '<div class="pl-inner">\
      <div class="group fade-up">\
        <div class="spinner" aria-label="Loading" role="status">\
          <div class="track"></div>\
          <div class="arc"></div>\
          <img class="logo-in" alt="Company Logo" />\
        </div>\
      </div>\
      <div class="brand fade-up" style="animation-delay:.08s">Loading…</div>\
      <div class="muted fade-up" style="animation-delay:.12s">Please wait a moment</div>\
    </div>';
        (document.body || document.documentElement).appendChild(overlay);


        (function tryCompanyBranding() {
            try {
                var cached = sessionStorage.getItem('companyDetails');
                var useData = null;
                if (cached) {
                    try { var parsed = JSON.parse(cached); useData = Array.isArray(parsed) ? (parsed[0] || null) : parsed; } catch (_) {/* ignore */ }
                }
                var applyBrand = function (company) {
                    try {
                        if (!company) return;
                        var logoUrl = company.icon_logo_url || company.alt_logo_url || '';
                        var name = company.company_name || company.name || '';
                        var imgEl = overlay.querySelector('.spinner .logo-in');
                        if (imgEl && logoUrl) { imgEl.src = logoUrl; imgEl.style.display = 'block'; }
                        if (name) {
                            var brandEl = overlay.querySelector('.brand');
                            if (brandEl) { brandEl.textContent = name; }
                        }
                    } catch (_) {/* noop */ }
                };
                if (useData) { applyBrand(useData); }

                fetch('/api/v1/company-details', { method: 'GET', headers: { 'Content-Type': 'application/json' } })
                    .then(function (res) { if (!res.ok) throw new Error('failed'); return res.json(); })
                    .then(function (data) {
                        try { sessionStorage.setItem('companyDetails', JSON.stringify(data)); } catch (_) {/* ignore */ }
                        var c = Array.isArray(data) ? (data[0] || null) : data; applyBrand(c);
                    })
                    .catch(function () { /* silently ignore */ });
            } catch (_) {/* ignore */ }
        })();

        var state = { navbar: false, sidebar: false, hidden: false, decided: false };
        function sidebarExpected() {
            try {
                return !!(document.getElementById('sidebarContainer') || document.getElementById('sidebar'));
            } catch (e) { return false; }
        }
        function maybeHide() {
            if (state.hidden) return;
            var needsSidebar = sidebarExpected();
            if (state.navbar && (!needsSidebar || state.sidebar)) {
                hide();
            }
        }
        function hide() {
            if (state.hidden) return; state.hidden = true;
            try { overlay.classList.add('hide'); setTimeout(function () { overlay.parentNode && overlay.parentNode.removeChild(overlay); }, 420); } catch (e) { try { overlay.remove(); } catch (_) { } }
        }
        function show() {
            try { overlay.classList.remove('hide'); } catch (e) { }
        }


        function waitForImagesLoaded(root, timeout) {
            return new Promise(function (resolve) {
                try {
                    var imgs = Array.prototype.slice.call((root || document).querySelectorAll('img'));
                    if (!imgs.length) return resolve();
                    var done = false; var t;
                    var remaining = imgs.length;
                    function check() { if (done) return; if (--remaining <= 0) { done = true; clearTimeout(t); resolve(); } }
                    imgs.forEach(function (img) { if (img.complete && img.naturalWidth > 0) { check(); } else { img.addEventListener('load', check, { once: true }); img.addEventListener('error', check, { once: true }); } });
                    t = setTimeout(function () { if (!done) { done = true; resolve(); } }, Math.max(1000, timeout || 4000));
                } catch (_) { resolve(); }
            });
        }
        function waitForFonts(timeout) {
            try {
                if (document.fonts && document.fonts.ready) {
                    var p1 = document.fonts.ready.catch(function () { });
                    var p2 = document.fonts.load && document.fonts.load('1em "Poppins"').catch(function () { });
                    return Promise.race([
                        Promise.all([p1, p2]).catch(function () { }),
                        new Promise(function (r) { setTimeout(r, Math.max(800, timeout || 2500)); })
                    ]);
                }
            } catch (_) {/* noop */ }
            return Promise.resolve();
        }
        function waitForStableSize(el, quietMs, capMs) {
            return new Promise(function (resolve) {
                try {
                    if (!el) return resolve();
                    var lastChange = Date.now();
                    var initial = el.getBoundingClientRect();
                    var ro;
                    var timer;
                    function done() { try { if (ro) ro.disconnect(); } catch (_) { } clearInterval(timer); resolve(); }
                    function mark() { lastChange = Date.now(); }
                    if (typeof ResizeObserver !== 'undefined') {
                        ro = new ResizeObserver(function () { mark(); });
                        ro.observe(el);
                    } else {
                        var prevW = initial.width, prevH = initial.height;
                        timer = setInterval(function () {
                            try { var r = el.getBoundingClientRect(); if (r.width !== prevW || r.height !== prevH) { prevW = r.width; prevH = r.height; mark(); } } catch (_) { }
                        }, 100);
                    }
                    var chk = setInterval(function () {
                        if (Date.now() - lastChange >= (quietMs || 220)) { clearInterval(chk); done(); }
                    }, 60);
                    setTimeout(function () { clearInterval(chk); done(); }, Math.max(1000, capMs || 3500));
                } catch (_) { resolve(); }
            });
        }
        function ensureStable(which) {
            try {
                if (which === 'navbar') {
                    var navEl = document.querySelector('.top-navbar');
                    if (!navEl) { return setTimeout(function () { ensureStable('navbar'); }, 60); }
                    Promise.all([
                        waitForImagesLoaded(navEl, 3500),
                        waitForFonts(2500),
                        waitForStableSize(navEl, 240, 4000)
                    ]).then(function () { state.navbar = true; maybeHide(); });
                } else if (which === 'sidebar') {
                    var sideEl = document.querySelector('#sidebar');
                    if (!sideEl) { return setTimeout(function () { ensureStable('sidebar'); }, 60); }
                    Promise.all([
                        waitForImagesLoaded(sideEl, 3500),
                        waitForFonts(2500),
                        waitForStableSize(sideEl, 280, 4500)
                    ]).then(function () { state.sidebar = true; maybeHide(); });
                }
            } catch (_) { if (which === 'navbar') { state.navbar = true; } else { state.sidebar = true; } maybeHide(); }
        }


        function onWindowLoad() {
            return new Promise(function (resolve) {
                if (document.readyState === 'complete') return resolve();
                window.addEventListener('load', function () { resolve(); }, { once: true });
            });
        }
        function waitNavbarEventOrTimeout(ms) {
            return new Promise(function (resolve) {
                var t = setTimeout(function () { resolve(); }, Math.max(600, ms || 1200));
                document.addEventListener('navbar:loaded', function () { clearTimeout(t); resolve(); }, { once: true });
            });
        }
        (function initMode() {

            document.addEventListener('navbar:loaded', function () { ensureStable('navbar'); }, { once: false });
            document.addEventListener('sidebar:loaded', function () { ensureStable('sidebar'); }, { once: false });
        })();


        setTimeout(hide, 10000);


        window.PageLoader = { hide: hide, show: show };
    } catch (e) {

        try { var pl = document.getElementById('page-loader'); if (pl) pl.parentNode && pl.parentNode.removeChild(pl); } catch (_) { }
    }
})();
