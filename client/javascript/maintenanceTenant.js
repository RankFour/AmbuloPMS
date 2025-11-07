import formatDate from '../utils/formatDate.js';
    class TenantMaintenancePortal {
            bindEvents() {
                const form = document.getElementById('maintenanceForm');
                if (form) {
                    form.addEventListener('submit', (e) => this.handleSubmit(e));
                }

                const fileInput = document.getElementById('photos');
                if (fileInput) {
                    fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
                }

                 
                const phoneCheckbox = document.getElementById('autoFillPhone');
                const contactPhoneInput = document.getElementById('contactPhone');
                if (phoneCheckbox && contactPhoneInput) {
                    phoneCheckbox.addEventListener('change', async (e) => {
                        if (e.target.checked) {
                             
                            const leaseSelect = document.getElementById('leaseSelect');
                            const selectedLease = this.leases.find(l => l.lease_id === leaseSelect.value);
                            let phone = '';
                            if (selectedLease && selectedLease.user_id) {
                                try {
                                    const userRes = await fetch(`/api/v1/users/${selectedLease.user_id}`);
                                    const userData = await userRes.json();
                                    if (userRes.ok && userData) {
                                        const u = userData.user || userData;
                                        phone = u.phone_number || '';
                                    }
                                } catch (err) {
                                    console.warn('Could not fetch user phone:', err);
                                }
                            }
                            contactPhoneInput.value = phone;
                            contactPhoneInput.readOnly = true;
                        } else {
                            contactPhoneInput.value = '';
                            contactPhoneInput.readOnly = false;
                        }
                    });
                }

                const historySearch = document.getElementById('historySearch');
                const statusFilter = document.getElementById('statusFilter');
                const categoryFilter = document.getElementById('categoryFilter');
                const dateFrom = document.getElementById('dateFrom');
                const dateTo = document.getElementById('dateTo');

                if (historySearch) historySearch.addEventListener('input', () => this.filterHistory());
                if (statusFilter) statusFilter.addEventListener('change', () => this.filterHistory());
                if (categoryFilter) categoryFilter.addEventListener('change', () => this.filterHistory());
                if (dateFrom) dateFrom.addEventListener('change', () => this.filterHistory());
                if (dateTo) dateTo.addEventListener('change', () => this.filterHistory());
            }
            constructor() {
                this.requests = [];
                this.history = [];
                this.filteredHistory = [];
                this.initLiveData();
            }

            async initLiveData() {
                let user = null;
                try {
                    user = JSON.parse(localStorage.getItem('user'));
                } catch (e) {}
                const userId = user && user.user_id ? user.user_id : null;
                this.leases = [];
                this.userProfile = user || {};
                if (!userId) {
                    this.requests = this.loadRequests();
                    this.history = this.loadHistory();
                    this.filteredHistory = [...this.history];
                    this.init();
                    return;
                }

                 
                try {
                    const leaseRes = await fetch(`/api/v1/leases/users/${userId}`);
                    const leaseData = await leaseRes.json();
                    this.leases = Array.isArray(leaseData) ? leaseData : leaseData.leases || [];
                } catch (err) {
                    this.leases = [];
                }

                 
                try {
                    const res = await fetch(`/api/v1/tickets/users/${userId}`);
                    const result = await res.json();
                    if (res.ok && result.tickets) {
                        this.requests = result.tickets.filter(t => t.ticket_status !== 'COMPLETED' && t.ticket_status !== 'CANCELLED');
                        this.history = result.tickets.filter(t => t.ticket_status === 'COMPLETED');
                        this.filteredHistory = [...this.history];
                    } else {
                        this.requests = this.loadRequests();
                        this.history = this.loadHistory();
                        this.filteredHistory = [...this.history];
                    }
                } catch (err) {
                    this.requests = this.loadRequests();
                    this.history = this.loadHistory();
                    this.filteredHistory = [...this.history];
                }
                this.init();
            }

            init() {
                this.populateLeaseDropdown();
                this.populateRequestTypeDropdown();
                this.bindEvents();
                this.displayOverview();
                this.displayRequests();
                this.displayHistory();
            }

            populateRequestTypeDropdown() {
                const categorySelect = document.getElementById('category');
                if (!categorySelect || !window.AppConstants || !window.AppConstants.TICKET_REQUEST_TYPES) return;
                categorySelect.innerHTML = '<option value="">Select a category</option>';
                window.AppConstants.TICKET_REQUEST_TYPES.forEach(opt => {
                    categorySelect.innerHTML += `<option value="${opt.value}">${opt.label}</option>`;
                });
            }

            populateLeaseDropdown() {
                const leaseSelect = document.getElementById('leaseSelect');
                if (!leaseSelect) return;
                leaseSelect.innerHTML = '<option value="">Select Lease</option>';
                this.leases.forEach(lease => {
                    const addressParts = [lease.building_name, lease.street, lease.city, lease.postal_code, lease.country].filter(Boolean);
                    const fullAddress = addressParts.join(', ');
                    leaseSelect.innerHTML += `<option value="${lease.lease_id}" data-property="${lease.property_name}" data-unit="${lease.unit_number || ''}">${lease.property_name} (${fullAddress})</option>`;
                });

                leaseSelect.addEventListener('change', async (e) => {
                    const tenantNameInput = document.getElementById('tenantName');
                    const unitNumberInput = document.getElementById('unitNumber');
                    const selectedLease = this.leases.find(l => l.lease_id === e.target.value);
                    
                    let userPhones = { phone_number: '', alt_phone_number: '' };
                    if (selectedLease) {
                        let fullName = selectedLease.tenant_name;
                        if (selectedLease.user_id) {
                            try {
                                const userRes = await fetch(`/api/v1/users/${selectedLease.user_id}`);
                                const userData = await userRes.json();
                                if (userRes.ok && userData) {
                                    const u = userData.user || userData;
                                    fullName = fullName || [u.first_name, u.middle_name, u.last_name, u.suffix].filter(Boolean).join(' ');
                                    userPhones.phone_number = u.phone_number || '';
                                    userPhones.alt_phone_number = u.alt_phone_number || '';
                                }
                            } catch (err) {
                                console.warn('Could not fetch user details:', err);
                            }
                        }
                        tenantNameInput.value = fullName || '';
                        unitNumberInput.value = selectedLease.property_name || '';
                        tenantNameInput.readOnly = true;
                        unitNumberInput.readOnly = true;
                    } else {
                        tenantNameInput.value = '';
                        unitNumberInput.value = '';
                        tenantNameInput.readOnly = false;
                        unitNumberInput.readOnly = false;
                    }
                     
                    this.renderContactPhoneDropdown(userPhones);
                });
            }
            renderContactPhoneDropdown(userPhones = { phone_number: '', alt_phone_number: '' }) {
                 
                const contactPhoneInput = document.getElementById('contactPhone');
                if (!contactPhoneInput) return;
                const group = contactPhoneInput.parentElement;
                if (!group) return;
                 
                while (group.firstChild) group.removeChild(group.firstChild);

                 
                const label = document.createElement('label');
                label.className = 'form-label required';
                label.htmlFor = 'contactPhoneSelect';
                label.textContent = 'Contact Phone';
                group.appendChild(label);

                 
                const select = document.createElement('select');
                select.id = 'contactPhoneSelect';
                select.className = 'form-select';
                select.required = true;

                let phoneOptions = [];
                if (userPhones.phone_number) phoneOptions.push(userPhones.phone_number);
                if (userPhones.alt_phone_number && userPhones.alt_phone_number !== userPhones.phone_number) phoneOptions.push(userPhones.alt_phone_number);
                phoneOptions = phoneOptions.filter(Boolean);
                phoneOptions.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p;
                    opt.textContent = p;
                    select.appendChild(opt);
                });
                 
                const otherOpt = document.createElement('option');
                otherOpt.value = 'other';
                otherOpt.textContent = 'Other Phone Number';
                select.appendChild(otherOpt);
                group.appendChild(select);

                 
                const input = document.createElement('input');
                input.type = 'tel';
                input.id = 'contactPhone';
                input.className = 'form-input';
                input.placeholder = '09XXXXXXXXX or 63XXXXXXXXXX';
                input.required = true;
                input.style.display = 'none';
                group.appendChild(input);

                 
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.id = 'contactPhoneError';
                group.appendChild(errorDiv);

                 
                select.addEventListener('change', () => {
                    if (select.value === 'other') {
                        input.style.display = '';
                        input.value = '';
                        input.focus();
                    } else {
                        input.style.display = 'none';
                        input.value = select.value;
                    }
                });
                 
                if (phoneOptions.length > 0) {
                    select.value = phoneOptions[0];
                    input.value = phoneOptions[0];
                } else {
                    select.value = 'other';
                    input.style.display = '';
                }
            }

            bindEvents() {
                const form = document.getElementById('maintenanceForm');
                if (form) {
                    form.addEventListener('submit', (e) => this.handleSubmit(e));
                }

                const fileInput = document.getElementById('photos');
                if (fileInput) {
                    fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
                }

                 
                this.renderContactPhoneDropdown();

                const historySearch = document.getElementById('historySearch');
                const statusFilter = document.getElementById('statusFilter');
                const categoryFilter = document.getElementById('categoryFilter');
                const dateFrom = document.getElementById('dateFrom');
                const dateTo = document.getElementById('dateTo');

                if (historySearch) historySearch.addEventListener('input', () => this.filterHistory());
                if (statusFilter) statusFilter.addEventListener('change', () => this.filterHistory());
                if (categoryFilter) categoryFilter.addEventListener('change', () => this.filterHistory());
                if (dateFrom) dateFrom.addEventListener('change', () => this.filterHistory());
                if (dateTo) dateTo.addEventListener('change', () => this.filterHistory());
            }

            async handleSubmit(e) {
                e.preventDefault();
                
                this.clearErrors();

                
                try {
                    await this.showConfirmationModal(e);
                } catch (err) {
                    console.warn('[Maintenance] showConfirmationModal failed, submitting directly', err);
                    
                    await this.submitTicket(e);
                }
            }

            async showConfirmationModal(originalEvent) {
                
                const ticketTitle = document.getElementById('ticketTitle')?.value || '';
                const leaseSelect = document.getElementById('leaseSelect');
                const leaseText = leaseSelect ? (leaseSelect.options[leaseSelect.selectedIndex]?.text || leaseSelect.value) : '';
                const category = document.getElementById('category')?.selectedOptions?.[0]?.text || document.getElementById('category')?.value || '';
                const priority = document.querySelector('input[name="priority"]:checked')?.value || '';
                const description = document.getElementById('description')?.value || '';

                
                const header = 'Submit this maintenance request?';
                const detailLines = [
                    `Title: ${ticketTitle}`,
                    `Lease: ${leaseText}`,
                    `Category: ${category}`,
                    `Priority: ${priority}`,
                    '',
                    'Description:',
                    description || ''
                ];
                const message = header + '\n\n' + detailLines.join('\n');

                
                try {
                    if (typeof window !== 'undefined' && typeof window.showConfirm === 'function') {
                        const ok = await window.showConfirm(message, 'Confirm Maintenance Request');
                        if (ok) await this.submitTicket(originalEvent);
                        return;
                    }
                } catch (err) {
                    console.warn('[Maintenance] ModalHelpers.showConfirm failed, falling back to DOM modal', err);
                }

                
                const modal = document.getElementById('confirmationModal');
                const confirmBtn = document.getElementById('confirmSubmit');
                const cancelBtn = document.getElementById('cancelSubmit');

                if (!modal) {
                    console.warn('[Maintenance] confirmationModal element not found — proceeding to submit without modal');
                    
                    await this.submitTicket(originalEvent);
                    return;
                }

                modal.style.display = 'flex';
                setTimeout(() => modal.classList.add('show'), 10);

                const handleCancel = () => {
                    this.hideConfirmationModal();
                    if (confirmBtn) confirmBtn.removeEventListener('click', handleConfirm);
                    if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
                };

                const handleConfirm = async () => {
                    await this.submitTicket(originalEvent);
                    if (confirmBtn) confirmBtn.removeEventListener('click', handleConfirm);
                    if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
                };

                if (confirmBtn && cancelBtn) {
                    confirmBtn.addEventListener('click', handleConfirm);
                    cancelBtn.addEventListener('click', handleCancel);
                } else {
                    console.warn('[Maintenance] confirm or cancel button not found on modal — submitting directly');
                    await this.submitTicket(originalEvent);
                    return;
                }

                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        handleCancel();
                    }
                });
            }

            hideConfirmationModal() {
                const modal = document.getElementById('confirmationModal');
                modal.classList.remove('show');
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
            }

            async submitTicket(originalEvent) {
                
                const confirmBtn = document.getElementById('confirmSubmit');
                let btnText = null;
                let btnLoading = null;
                if (confirmBtn) {
                    btnText = confirmBtn.querySelector('.btn-text');
                    btnLoading = confirmBtn.querySelector('.btn-loading');
                    confirmBtn.disabled = true;
                    if (btnText) btnText.style.display = 'none';
                    if (btnLoading) btnLoading.style.display = 'flex';
                }

                const formData = new FormData();
                 
                formData.append('ticket_title', document.getElementById('ticketTitle').value);
                formData.append('lease_id', document.getElementById('leaseSelect').value);
                formData.append('unit_number', document.getElementById('unitNumber').value);
                formData.append('request_type', document.getElementById('category').value);
                formData.append('priority', document.querySelector('input[name="priority"]:checked')?.value || '');
                formData.append('description', document.getElementById('description').value);
                 
                let user = null;
                try {
                    user = JSON.parse(localStorage.getItem('user'));
                } catch (e) {}
                if (user && user.user_id) {
                    formData.append('user_id', user.user_id);
                }
                 
                const select = document.getElementById('contactPhoneSelect');
                const input = document.getElementById('contactPhone');
                let contactPhone = '';
                if (select && select.value === 'other' && input) {
                    contactPhone = input.value;
                } else if (select) {
                    contactPhone = select.value;
                }
                formData.append('phone_number', contactPhone);

                if (Array.isArray(this.selectedFiles) && this.selectedFiles.length > 0) {
                    this.selectedFiles.forEach((file, idx) => {
                        formData.append('attachments', file, file.name);
                    });
                }

                try {
                    const res = await fetch('/api/v1/tickets/create-ticket', {
                        method: 'POST',
                        body: formData
                    });
                    const result = await res.json();
                    if (res.ok && result && result.ticket_id) {
                        this.hideConfirmationModal();
                        this.showSuccessMessage(result.ticket_id);
                        originalEvent.target.reset();
                        this.selectedFiles = [];
                        this.displayOverview();
                        this.displayRequests();
                        this.renderContactPhoneDropdown();
                    } else {
                        this.hideConfirmationModal();
                        this.showError('descriptionError', result?.message || 'Failed to submit request.');
                    }
                } catch (err) {
                    this.hideConfirmationModal();
                    this.showError('descriptionError', 'Network error. Please try again.');
                } finally {
                     
                    confirmBtn.disabled = false;
                    btnText.style.display = 'flex';
                    btnLoading.style.display = 'none';
                }
            }

            showError(elementId, message) {
                const errorElement = document.getElementById(elementId);
                if (errorElement) {
                    errorElement.textContent = message;
                }
            }

            clearErrors() {
                const errorElements = document.querySelectorAll('.error-message');
                errorElements.forEach(el => el.textContent = '');
            }

            showSuccessMessage(requestId) {
                const successMessage = document.getElementById('successMessage');
                const requestIdSpan = document.getElementById('requestId');
                
                if (successMessage && requestIdSpan) {
                    requestIdSpan.textContent = requestId;
                    successMessage.style.display = 'block';
                    
                    
                    setTimeout(() => {
                        successMessage.style.display = 'none';
                    }, 10000);

                    successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }

             
            selectedFiles = [];
            handleFileUpload(e) {
                const input = e.target;
                const wrapper = input.closest('.file-upload-wrapper');
                let previewBox = wrapper.querySelector('.file-upload-preview');
                if (!previewBox) {
                    previewBox = document.createElement('div');
                    previewBox.className = 'file-upload-preview';
                    wrapper.appendChild(previewBox);
                }

                 
                const allowedTypes = /^(image|video)\//;
                let newFiles = Array.from(input.files).filter(f => allowedTypes.test(f.type) && f.size <= 10 * 1024 * 1024);
                 
                newFiles = newFiles.filter(f => !this.selectedFiles.some(sf => sf.name === f.name && sf.size === f.size));
                let errorMsg = '';
                 
                if (input.files.length > 0 && newFiles.length !== input.files.length) {
                    errorMsg = 'Only image/video files up to 10MB each are allowed.';
                }
                 
                if (this.selectedFiles.length + newFiles.length > 5) {
                    errorMsg = 'You can only upload up to 5 files.';
                    newFiles = [];
                }
                 
                this.selectedFiles = [...this.selectedFiles, ...newFiles].slice(0, 5);

                 
                if (this.selectedFiles.length === 0) {
                    previewBox.innerHTML = `<span><i class=\"fa-solid fa-paperclip\"></i></span> <span>Click to upload photos/videos (optional, up to 5 files, max 10MB each)</span>`;
                    input.value = '';
                    return;
                }

                 
                let errorHtml = errorMsg ? `<span style='color:red;'>${errorMsg}</span>` : '';
                previewBox.innerHTML = errorHtml + `<div class='file-preview-list'>${this.selectedFiles.map((file, idx) => {
                    let thumb = '';
                    if (file.type.startsWith('image/')) {
                        thumb = `<img src='' data-idx='${idx}' alt='${file.name}'/>`;
                    } else if (file.type.startsWith('video/')) {
                        thumb = `<span class='video-icon'><i class='fa-solid fa-film'></i></span>`;
                    } else {
                        thumb = `<span class='file-icon'><i class='fa-solid fa-file'></i></span>`;
                    }
                    return `<div class='file-thumb'>${thumb}<button type='button' class='remove-file-btn' data-idx='${idx}' title='Remove'>&times;</button><div class='file-name'>${file.name}</div></div>`;
                }).join('')}</div>`;
                 
                this.selectedFiles.forEach((file, idx) => {
                    if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = function(ev) {
                            const img = previewBox.querySelector(`img[data-idx='${idx}']`);
                            if (img) img.src = ev.target.result;
                        };
                        reader.readAsDataURL(file);
                    }
                });
                 
                previewBox.querySelectorAll('.remove-file-btn').forEach(btn => {
                    btn.onclick = () => {
                        const idx = parseInt(btn.getAttribute('data-idx'));
                        this.selectedFiles.splice(idx, 1);
                        this.handleFileUpload({ target: input }); // re-render
                    };
                });
                 
                input.value = '';
            }

            displayOverview() {
                const overviewGrid = document.getElementById('overviewGrid');
                if (!overviewGrid) return;

                const totalRequests = this.requests.length + this.history.length;
                const activeRequests = this.requests.filter(r => r.status !== 'completed' && r.status !== 'cancelled').length;
                const completedRequests = this.history.filter(r => r.status === 'completed').length;
                const avgRating = this.history.length > 0 ? 
                    (this.history.reduce((sum, r) => sum + (r.rating || 0), 0) / this.history.filter(r => r.rating).length).toFixed(1) : 
                    'N/A';

                overviewGrid.innerHTML = `
                    <div class="overview-card total">
                        <div class="overview-header">
                            <span class="overview-icon"><i class="fa-solid fa-ticket"></i></span>
                        </div>
                        <div class="overview-number">${totalRequests}</div>
                        <div class="overview-label">Total Requests</div>
                        <div class="overview-description">All maintenance requests submitted</div>
                    </div>
                    <div class="overview-card active">
                        <div class="overview-header">
                            <span class="overview-icon"><i class="fa-solid fa-spinner"></i></span>
                        </div>
                        <div class="overview-number">${activeRequests}</div>
                        <div class="overview-label">Active Requests</div>
                        <div class="overview-description">Currently pending or in progress</div>
                    </div>
                    <div class="overview-card completed">
                        <div class="overview-header">
                            <span class="overview-icon"><i class="fa-solid fa-circle-check"></i></span>
                        </div>
                        <div class="overview-number">${completedRequests}</div>
                        <div class="overview-label">Completed</div>
                        <div class="overview-description">Successfully resolved requests</div>
                    </div>
                    <div class="overview-card rating">
                        <div class="overview-header">
                            <span class="overview-icon"><i class="fa-solid fa-star"></i></span>
                        </div>
                        <div class="overview-number">${avgRating}</div>
                        <div class="overview-label">Avg Rating</div>
                        <div class="overview-description">Service satisfaction score</div>
                    </div>
                `;
            }

            displayRequests() {
                const requestsList = document.getElementById('requestsList');
                if (!requestsList) return;

                if (this.requests.length === 0) {
                    requestsList.innerHTML = `
                        <div class="empty-state" style="text-align:center;padding:2rem;">
                            <div class="empty-state-icon" style="font-size:3rem;color:#3b82f6;margin-bottom:0.5rem;">
                                <i class="fa-solid fa-clipboard-list"></i>
                            </div>
                            <p style="font-size:1.2rem;color:#555;">No active requests at this time</p>
                            <div style="margin-top:0.5rem;color:#888;font-size:1rem;">
                                <i class="fa-solid fa-circle-info"></i> You have no pending or in-progress maintenance requests.
                            </div>
                        </div>
                    `;
                    return;
                }

                requestsList.innerHTML = this.requests.map(request => {
                    const id = request.ticket_id || request.id || '';
                    const title = request.ticket_title || request.title || '';
                    const propertyName = request.property_name || request.propertyName || '';
                    const status = (request.ticket_status || request.status || '').toLowerCase();
                    const category = request.request_type || request.category || '';
                    const priority = request.priority || '';
                    const description = request.description || '';
                    const submittedDate = request.created_at || request.submittedDate || '';
                    const startTime = request.start_datetime || request.startTime || '';
                    const assignedTechnician = request.assigned_to || request.assignedTechnician || '';
                    const estimatedCompletion = request.end_datetime || request.estimatedCompletion || '';

                    return `
                        <div class="request-item active-request-item">
                            <div class="request-header">
                                <div class="request-id"><strong>Ticket ID:</strong> ${id}</div>
                                <div class="status-badge status-${status}">
                                    ${status === 'pending' ? 'Pending Review' :
                                      status === 'assigned' ? 'Assigned' :
                                      status === 'in_progress' ? 'In Progress' :
                                      status === 'completed' ? 'Completed' :
                                      status.charAt(0).toUpperCase() + status.slice(1)}
                                </div>
                            </div>
                            <div class="request-content">
                                ${title ? `<div class="ticket-title"><h3>${title}</h3></div>` : ''}
                                <div class="property-name"><i class='fa-solid fa-building'></i> ${propertyName ? propertyName : 'N/A'}</div>
                                <div class="request-category">${this.getCategoryLabel(category)}</div>
                                <div class="request-description">${description}</div>
                            </div>
                            <div class="request-meta">
                                <div class="request-meta-item">
                                    <span><i class="fa-solid fa-calendar"></i></span>
                                    <span>Submitted: ${this.formatDate(submittedDate)}</span>
                                </div>
                                <div class="request-meta-item">
                                    <span><i class="fa-solid fa-clock"></i></span>
                                    <span>Start Time: ${startTime ? formatDate(startTime, true) : 'Not scheduled'}</span>
                                </div>
                                <div class="priority-badge priority-${priority}">
                                    ${priority ? priority.toUpperCase() + ' PRIORITY' : ''}
                                </div>
                            </div>
                            ${assignedTechnician ? `
                                <div class="request-meta">
                                    <div class="request-meta-item">
                                        <span><i class="fa-solid fa-user"></i></span>
                                        <span>Assigned to: ${assignedTechnician}</span>
                                    </div>
                                    ${estimatedCompletion ? `
                                        <div class="request-meta-item">
                                            <span><i class="fa-solid fa-bullseye"></i></span>
                                            <span>Est. completion: ${formatDate(estimatedCompletion, true)}</span>
                                        </div>
                                    ` : ''}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('');
            }

            displayHistory() {
                const historyList = document.getElementById('historyList');
                if (!historyList) return;

                if (this.filteredHistory.length === 0) {
                    historyList.innerHTML = `
                        <div class="empty-state" style="text-align:center;padding:2rem;">
                            <div class="empty-state-icon" style="font-size:3rem;color:#059669;margin-bottom:0.5rem;">
                                <i class="fa-solid fa-book-open"></i>
                            </div>
                            <p style="font-size:1.2rem;color:#555;">No history records match your current filters</p>
                            <div style="margin-top:0.5rem;color:#888;font-size:1rem;">
                                <i class="fa-solid fa-circle-info"></i> Try adjusting your filters or check back later.
                            </div>
                        </div>
                    `;
                    return;
                }

                historyList.innerHTML = this.filteredHistory.map(item => {
                    const id = item.ticket_id || item.id || '';
                    const title = item.ticket_title || item.title || '';
                    const propertyName = item.property_name || item.propertyName || '';
                    const status = (item.ticket_status || item.status || '').toLowerCase();
                    const category = item.request_type || item.category || '';
                    const priority = item.priority || '';
                    const description = item.description || '';
                    const submittedDate = item.created_at || item.submittedDate || '';
                    const completedDate = item.end_datetime || item.completedDate || '';
                    const assignedTechnician = item.assigned_to || item.assignedTechnician || '';
                    const resolution = item.notes || item.resolution || '';
                    const cost = item.maintenance_cost || item.cost || '';
                    const rating = item.rating || '';

                    return `
                        <div class="history-item ${status}">
                            <div class="history-header">
                                <div class="request-id"><strong>Ticket ID:</strong> ${id}</div>
                                <div class="history-dates">
                                    <div>Submitted: ${formatDate(submittedDate, true)}</div>
                                    <div>Completed: ${formatDate(completedDate, true)}</div>
                                </div>
                            </div>
                            <div class="history-content">
                                ${title ? `<div class="ticket-title"><h3>${title}</h3></div>` : ''}
                                <div class="property-name"><i class='fa-solid fa-building'></i> ${propertyName ? propertyName : 'N/A'}</div>
                                <div class="history-category">${this.getCategoryLabel(category)}</div>
                                <div class="history-description">${description}</div>
                                ${resolution ? `
                                    <div class="resolution-text">
                                        <strong>Resolution:</strong> ${resolution}
                                    </div>
                                ` : ''}
                            </div>
                            <div class="history-footer">
                                <div class="footer-left">
                                    <div class="technician-info"><i class="fa-solid fa-user"></i> ${assignedTechnician}</div>
                                    ${cost ? `<div class="cost-info"><i class="fa-solid fa-dollar-sign"></i> Cost: ${parseFloat(cost).toFixed(2)}</div>` : ''}
                                </div>
                                <div class="footer-right">
                                    <div class="priority-badge priority-${priority}">
                                        ${priority ? priority.toUpperCase() : ''}
                                    </div>
                                    ${rating ? `
                                        <div class="rating-stars">
                                            ${'⭐'.repeat(rating)}
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            filterHistory() {
                const searchTerm = document.getElementById('historySearch')?.value.toLowerCase() || '';
                const statusFilter = document.getElementById('statusFilter')?.value || '';
                const categoryFilter = document.getElementById('categoryFilter')?.value || '';
                const dateFrom = document.getElementById('dateFrom')?.value || '';
                const dateTo = document.getElementById('dateTo')?.value || '';

                this.filteredHistory = this.history.filter(item => {
                    const matchesSearch = !searchTerm || 
                        item.id.toLowerCase().includes(searchTerm) ||
                        item.description.toLowerCase().includes(searchTerm) ||
                        item.category.toLowerCase().includes(searchTerm) ||
                        (item.resolution && item.resolution.toLowerCase().includes(searchTerm));

                    const matchesStatus = !statusFilter || item.status === statusFilter;

                    
                    const matchesCategory = !categoryFilter || item.category === categoryFilter;


                    let matchesDateRange = true;
                    if (dateFrom && item.completedDate) {
                        matchesDateRange = matchesDateRange && item.completedDate >= dateFrom;
                    }
                    if (dateTo && item.completedDate) {
                        matchesDateRange = matchesDateRange && item.completedDate <= dateTo;
                    }

                    return matchesSearch && matchesStatus && matchesCategory && matchesDateRange;
                });

                this.displayHistory();
            }

            getCategoryLabel(category) {
                const labels = {
                    'plumbing': 'Plumbing Services',
                    'electrical': 'Electrical Services',
                    'hvac': 'HVAC & Climate Control',
                    'appliance': 'Appliance Repair',
                    'structural': 'Structural & Building',
                    'security': 'Security Systems',
                    'other': 'Other Services'
                };
                return labels[category] || category;
            }

            formatDate(dateString) {
                if (!dateString) return '';
                const date = new Date(dateString);
                return date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            }

            saveRequests() {
                 
                
            }
        }

         
        document.addEventListener('DOMContentLoaded', () => {
            new TenantMaintenancePortal();
        });