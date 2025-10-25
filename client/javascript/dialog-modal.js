    
    const Modal = {
      el: null,
      titleEl: null,
      bodyEl: null,
      footerEl: null,
      containerEl: null,
      onConfirm: null,
      onCancel: null,
      _autoCloseTimer: null,
      _autoCloseStartTs: 0,
      _autoCloseDuration: 0,
      _autoCloseInterval: null,
      _lastFocused: null,
      _boundTrap: null,

      init() {
        this.el = document.getElementById('globalModal');
        this.titleEl = document.getElementById('modalTitle');
        this.bodyEl = document.getElementById('modalBody');
        this.footerEl = document.getElementById('modalFooter');
        this.containerEl = this.el && this.el.querySelector('.modal-container');

        
        try {
          if (this.containerEl) {
            this.containerEl.setAttribute('role', 'dialog');
            this.containerEl.setAttribute('aria-modal', 'true');
            this.containerEl.setAttribute('aria-labelledby', 'modalTitle');
            
            this.containerEl.tabIndex = -1;
          }
        } catch (e) {}

        
        this._boundTrap = this._trapFocus.bind(this);

        
        if (this.el) {
          this.el.addEventListener('click', (e) => {
            if (e.target === this.el) {
              this.close();
            }
          });
        }

        
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && this.el && this.el.classList.contains('active')) {
            this.close();
          }
        });
      },

      open(options = {}) {
        const {
          title = 'Modal',
          body = '',
          showFooter = true,
          showCancel = true,
          confirmText = 'OK',
          cancelText = 'Cancel',
          onConfirm = null,
          onCancel = null,
          variant = 'default',
          autoCloseDuration = 0
        } = options;

  this.onConfirm = onConfirm;
  this.onCancel = onCancel;

        
        try {
          const svgs = {
            success: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M9.00039 16.2L4.80039 12L3.40039 13.4L9.00039 19L21.0004 7L19.6004 5.6L9.00039 16.2Z"/></svg>`,
            error: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M11.001 10h2v5h-2zM11 16h2v2h-2zM1 21h22L12 2 1 21z"/></svg>`,
            warning: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M1 21h22L12 2 1 21zm12-3h-2v2h2v-2zm0-8h-2v6h2V10z"/></svg>`,
            default: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm0 15a1.5 1.5 0 1 1 .001-3.001A1.5 1.5 0 0 1 12 17zm1-7h-2V7h2v3z"/></svg>`
          };
          const svg = svgs[variant] || svgs.default;
          if (this.titleEl) {
            this.titleEl.innerHTML = `<span class="modal-icon" aria-hidden="true">${svg}</span><span class="modal-title-text">${String(title)}</span>`;
          }
        } catch (e) {
          try { this.titleEl.textContent = title; } catch (err) {}
        }
        
        if (typeof body === 'string') {
          this.bodyEl.innerHTML = body;
        } else {
          this.bodyEl.innerHTML = '';
          this.bodyEl.appendChild(body);
        }

        if (showFooter) {
          this.footerEl.style.display = 'flex';
          this.footerEl.innerHTML = '';

          if (showCancel) {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'btn-cancel';
            cancelBtn.textContent = cancelText;
            cancelBtn.onclick = () => this.cancel();
            this.footerEl.appendChild(cancelBtn);
          }

          const confirmBtn = document.createElement('button');
          confirmBtn.className = variant === 'delete' ? 'btn-delete' : 'btn-confirm';
          confirmBtn.textContent = confirmText;
          confirmBtn.onclick = () => this.confirm();
          this.footerEl.appendChild(confirmBtn);
        } else {
          this.footerEl.style.display = 'none';
        }

        
        try {
          if (this.containerEl) {
            this.containerEl.setAttribute('data-variant', variant || 'default');
          }
        } catch (e) {}

        
        this._clearAutoClose();
        if (!showFooter && autoCloseDuration && Number(autoCloseDuration) > 0) {
          this._setupAutoClose(Number(autoCloseDuration));
        }

        
        try {
          this._lastFocused = document.activeElement;
        } catch (e) { this._lastFocused = null; }

        document.body.style.overflow = 'hidden';
        if (this.el) this.el.classList.add('active');

        
        try {
          if (this.el && this._boundTrap) this.el.addEventListener('keydown', this._boundTrap);
          
          const focusable = this._getFocusableElements();
          if (focusable && focusable.length) {
            focusable[0].focus();
          } else if (this.containerEl && typeof this.containerEl.focus === 'function') {
            this.containerEl.focus();
          }
        } catch (e) {}
      },

      close() {
        if (this.el) this.el.classList.remove('active');
        document.body.style.overflow = '';
        this.onConfirm = null;
        this.onCancel = null;
        this._clearAutoClose();

        
        try {
          if (this.el && this._boundTrap) this.el.removeEventListener('keydown', this._boundTrap);
          if (this._lastFocused && typeof this._lastFocused.focus === 'function') {
            this._lastFocused.focus();
          }
          this._lastFocused = null;
        } catch (e) {}

        try {
          if (this.containerEl) this.containerEl.removeAttribute('data-variant');
        } catch (e) {}
      },

      confirm() {
        if (this.onConfirm) {
          this.onConfirm();
        }
        this.close();
      },

      cancel() {
        if (this.onCancel) {
          this.onCancel();
        }
        this.close();
      }
      ,

      _setupAutoClose(ms) {
        try {
          this._autoCloseDuration = ms;
          this._autoCloseStartTs = Date.now();
          
            if (this.containerEl) {
              let accent = this.containerEl.querySelector('.modal-accent');
              if (!accent) {
                accent = document.createElement('div');
                accent.className = 'modal-accent';
                const prog = document.createElement('div');
                prog.className = 'modal-progress';
                accent.appendChild(prog);
                
                this.containerEl.appendChild(accent);
              } else {
                let prog = accent.querySelector('.modal-progress');
                if (!prog) {
                  prog = document.createElement('div');
                  prog.className = 'modal-progress';
                  accent.appendChild(prog);
                }
              }
            }

          
          const tick = () => {
            const elapsed = Date.now() - this._autoCloseStartTs;
            const pct = Math.max(0, 1 - elapsed / this._autoCloseDuration);
            try {
              const prog = this.containerEl && this.containerEl.querySelector('.modal-progress');
              if (prog) prog.style.width = (pct * 100).toFixed(2) + '%';
            } catch (e) {}
            if (elapsed >= this._autoCloseDuration) {
              this._clearAutoClose();
              try { this.close(); } catch (e) {}
            }
          };

          
          tick();
          this._autoCloseInterval = setInterval(tick, 50);
        } catch (e) {
          console.warn('Auto-close setup failed', e);
        }
      },

      _clearAutoClose() {
        try {
          if (this._autoCloseInterval) {
            clearInterval(this._autoCloseInterval);
            this._autoCloseInterval = null;
          }
          this._autoCloseDuration = 0;
          this._autoCloseStartTs = 0;
          if (this.containerEl) {
            const acc = this.containerEl.querySelector('.modal-accent');
            if (acc && acc.parentNode) acc.parentNode.removeChild(acc);
          }
        } catch (e) {}
      }
      ,

      /* focus helpers */
      _getFocusableElements() {
        try {
          if (!this.el) return [];
          const nodes = Array.from(this.el.querySelectorAll('a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'));
          
          return nodes.filter((n) => n.offsetWidth > 0 || n.offsetHeight > 0 || n.getClientRects().length);
        } catch (e) { return []; }
      },

      _trapFocus(e) {
        if (e.key !== 'Tab') return;
        const focusable = this._getFocusableElements();
        if (!focusable || focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      }
    };

    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => Modal.init());
    } else {
      Modal.init();
    }