    // Global Modal Object
    const Modal = {
      el: null,
      titleEl: null,
      bodyEl: null,
      footerEl: null,
      onConfirm: null,
      onCancel: null,

      init() {
        this.el = document.getElementById('globalModal');
        this.titleEl = document.getElementById('modalTitle');
        this.bodyEl = document.getElementById('modalBody');
        this.footerEl = document.getElementById('modalFooter');

        // Close on overlay click
        this.el.addEventListener('click', (e) => {
          if (e.target === this.el) {
            this.close();
          }
        });

        // Close on ESC key
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && this.el.classList.contains('active')) {
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
          variant = 'default'
        } = options;

        this.onConfirm = onConfirm;
        this.onCancel = onCancel;

        this.titleEl.textContent = title;
        
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

        document.body.style.overflow = 'hidden';
        this.el.classList.add('active');
      },

      close() {
        this.el.classList.remove('active');
        document.body.style.overflow = '';
        this.onConfirm = null;
        this.onCancel = null;
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
    };

    // Initialize modal when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => Modal.init());
    } else {
      Modal.init();
    }