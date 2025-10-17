// Sample data structure
let wallets = [
    {
        id: 1,
        name: 'GCash',
        icon: 'fas fa-wallet',
        accountName: 'GCash',
        number: '+63 917 000 0000',
        reference: 'Include lease ID',
        qrCode: ''
    },
    {
        id: 2,
        name: 'Maya',
        icon: 'fas fa-mobile-alt',
        accountName: 'Maya',
        number: '+63 918 123 4567',
        reference: 'Include lease ID',
        qrCode: ''
    }
];

let bankDetails = {
    qrCode: '',
    bank: 'BDO Unibank',
    accountName: 'Ambulo Property Management',
    accountNo: '0000-1234-5678',
    branch: 'Makati Avenue'
};

let cashDetails = {
    title: 'Cash Payment',
    description: 'Visit the property management office during business hours to settle your balance in cash. Bring a valid ID and mention your lease reference when paying.',
    officeHours: 'Monday - Friday, 9:00 AM - 5:00 PM',
    officeLocation: 'Main Office, Ground Floor'
};

let checkDetails = {
    title: 'Check Payment',
    description: 'Issue checks payable to Ambulo Property Management. Kindly write your full name, unit, and contact number at the back of the check. Post-dated checks are accepted for future-dated payments.',
    payableTo: 'Ambulo Property Management',
    instructions: 'Write full name, unit, and contact number at the back'
};

let tutorialDetails = {
    title: 'Payment Instructions',
    uploadInstructions: 'Upload a screenshot of the successful wallet transfer and keep the in-app transaction ID for our verification team.',
    walletInstructions: 'After transferring, upload your payment proof and keep the reference number for verification.',
    bankInstructions: 'After transferring, upload your payment proof and keep the reference number for verification.',
    additionalNotes: 'Please ensure all payment details are correct before submitting.'
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    renderWallets();
    renderBankDetails();
    renderCashDetails();
    renderCheckDetails();
    renderTutorialDetails();
    
    // Setup form submission
    document.getElementById('paymentForm').addEventListener('submit', handleFormSubmit);
});

// Tab switching function
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
    
    event.target.closest('.tab-btn').classList.add('active');
    document.getElementById(tab).classList.add('active');
}

// Render wallets grid
function renderWallets() {
    const grid = document.getElementById('walletGrid');
    grid.innerHTML = wallets.map(wallet => `
        <div class="payment-card">
            <div class="card-header">
                <span class="card-icon"><i class="${wallet.icon}"></i></span>
                <span class="card-title">${wallet.name}</span>
            </div>
            <div class="qr-placeholder ${wallet.qrCode ? '' : 'empty'}">
                ${wallet.qrCode ? `<img src="${wallet.qrCode}" alt="QR Code">` : ''}
            </div>
            <div class="detail-row">
                <span class="detail-label">Account Name</span>
                <span class="detail-value">${wallet.accountName}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">${wallet.name} Number</span>
                <span class="detail-value">${wallet.number}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Reference</span>
                <span class="detail-value">${wallet.reference}</span>
            </div>
            <div class="card-actions">
                <button class="btn btn-edit" onclick="editWallet(${wallet.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-delete" onclick="deleteWallet(${wallet.id})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

// Render bank details
function renderBankDetails() {
    const container = document.getElementById('bankDetails');
    container.innerHTML = `
        <div class="bank-header">
            <i class="fas fa-university" style="font-size: 32px; color: var(--primary-color);"></i>
            <h3 style="font-size: 1.5rem; font-weight: 600; color: var(--text-primary);">Bank Transfer Details</h3>
        </div>
        ${bankDetails.qrCode ? `
            <div class="qr-placeholder" style="margin-bottom: 24px;">
                <img src="${bankDetails.qrCode}" alt="Bank QR Code">
            </div>
        ` : ''}
        <div class="detail-row">
            <span class="detail-label">Bank Name</span>
            <span class="detail-value">${bankDetails.bank}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Account Name</span>
            <span class="detail-value">${bankDetails.accountName}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Account Number</span>
            <span class="detail-value">${bankDetails.accountNo}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Branch</span>
            <span class="detail-value">${bankDetails.branch}</span>
        </div>
    `;
}

// Render cash details
function renderCashDetails() {
    const container = document.getElementById('cashContent');
    container.innerHTML = `
        <div class="info-card">
            <div class="info-header">
                <i class="fas fa-money-bill-wave"></i>
                <h3>${cashDetails.title}</h3>
            </div>
            <p class="info-description">${cashDetails.description}</p>
            <div class="detail-row" style="margin-top: 20px;">
                <span class="detail-label">Office Hours</span>
                <span class="detail-value">${cashDetails.officeHours}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Location</span>
                <span class="detail-value">${cashDetails.officeLocation}</span>
            </div>
        </div>
    `;
}

// Render check details
function renderCheckDetails() {
    const container = document.getElementById('checkContent');
    container.innerHTML = `
        <div class="info-card">
            <div class="info-header">
                <i class="fas fa-money-check"></i>
                <h3>${checkDetails.title}</h3>
            </div>
            <p class="info-description">${checkDetails.description}</p>
            <div class="detail-row" style="margin-top: 20px;">
                <span class="detail-label">Payable To</span>
                <span class="detail-value"><strong>${checkDetails.payableTo}</strong></span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Instructions</span>
                <span class="detail-value">${checkDetails.instructions}</span>
            </div>
        </div>
    `;
}

// Render tutorial details
function renderTutorialDetails() {
    const container = document.getElementById('tutorialContent');
    container.innerHTML = `
        <div class="tutorial-container">
            <div class="tutorial-card">
                <div class="tutorial-header">
                    <i class="fas fa-graduation-cap"></i>
                    <h3>${tutorialDetails.title}</h3>
                </div>
                
                <div class="tutorial-section">
                    <div class="tutorial-icon-box">
                        <i class="fas fa-wallet"></i>
                    </div>
                    <div class="tutorial-content">
                        <h4>E-Wallet Payments</h4>
                        <p>${tutorialDetails.walletInstructions}</p>
                    </div>
                </div>

                <div class="tutorial-section">
                    <div class="tutorial-icon-box bank">
                        <i class="fas fa-university"></i>
                    </div>
                    <div class="tutorial-content">
                        <h4>Bank Transfer</h4>
                        <p>${tutorialDetails.bankInstructions}</p>
                    </div>
                </div>

                <div class="tutorial-section">
                    <div class="tutorial-icon-box upload">
                        <i class="fas fa-cloud-upload-alt"></i>
                    </div>
                    <div class="tutorial-content">
                        <h4>Upload Payment Proof</h4>
                        <p>${tutorialDetails.uploadInstructions}</p>
                    </div>
                </div>

                ${tutorialDetails.additionalNotes ? `
                <div class="tutorial-notes">
                    <i class="fas fa-info-circle"></i>
                    <p>${tutorialDetails.additionalNotes}</p>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

// Modal functions
function openModal(mode, type) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const walletFields = document.getElementById('walletFields');
    const bankFields = document.getElementById('bankFields');
    const cashFields = document.getElementById('cashFields');
    const checkFields = document.getElementById('checkFields');
    const tutorialFields = document.getElementById('tutorialFields');
    
    // Reset form
    document.getElementById('paymentForm').reset();
    document.getElementById('qrPreview').innerHTML = '';
    document.getElementById('bankQrPreview').innerHTML = '';
    document.getElementById('editId').value = '';
    document.getElementById('editType').value = type;
    
    // Hide all fields first
    walletFields.style.display = 'none';
    bankFields.style.display = 'none';
    cashFields.style.display = 'none';
    checkFields.style.display = 'none';
    tutorialFields.style.display = 'none';
    
    // Show/hide fields based on type
    if (type === 'wallet') {
        walletFields.style.display = 'block';
        modalTitle.textContent = mode === 'add' ? 'Add New Wallet' : 'Edit Wallet';
    } else if (type === 'bank') {
        bankFields.style.display = 'block';
        modalTitle.textContent = 'Edit Bank Details';
        
        // Populate bank details
        document.getElementById('bankName').value = bankDetails.bank;
        document.getElementById('bankAccountName').value = bankDetails.accountName;
        document.getElementById('bankAccountNo').value = bankDetails.accountNo;
        document.getElementById('branch').value = bankDetails.branch;
        
        if (bankDetails.qrCode) {
            document.getElementById('bankQrPreview').innerHTML = `<img src="${bankDetails.qrCode}" alt="QR Preview">`;
        }
    } else if (type === 'cash') {
        cashFields.style.display = 'block';
        modalTitle.textContent = 'Edit Cash Payment Details';
        
        // Populate cash details
        document.getElementById('cashTitle').value = cashDetails.title;
        document.getElementById('cashDescription').value = cashDetails.description;
        document.getElementById('officeHours').value = cashDetails.officeHours;
        document.getElementById('officeLocation').value = cashDetails.officeLocation;
    } else if (type === 'check') {
        checkFields.style.display = 'block';
        modalTitle.textContent = 'Edit Check Payment Details';
        
        // Populate check details
        document.getElementById('checkTitle').value = checkDetails.title;
        document.getElementById('checkDescription').value = checkDetails.description;
        document.getElementById('payableTo').value = checkDetails.payableTo;
        document.getElementById('checkInstructions').value = checkDetails.instructions;
    }

    else if (type === 'tutorial') {
    tutorialFields.style.display = 'block';
    modalTitle.textContent = 'Edit Tutorial Instructions';
    
    // Populate tutorial details
    document.getElementById('tutorialTitle').value = tutorialDetails.title;
    document.getElementById('uploadInstructions').value = tutorialDetails.uploadInstructions;
    document.getElementById('walletInstructions').value = tutorialDetails.walletInstructions;
    document.getElementById('bankInstructions').value = tutorialDetails.bankInstructions;
    document.getElementById('additionalNotes').value = tutorialDetails.additionalNotes;
    }
    
    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

// Edit wallet
function editWallet(id) {
    const wallet = wallets.find(w => w.id === id);
    if (!wallet) return;
    
    openModal('edit', 'wallet');
    
    document.getElementById('editId').value = wallet.id;
    document.getElementById('walletName').value = wallet.name;
    document.getElementById('accountName').value = wallet.accountName;
    document.getElementById('accountNumber').value = wallet.number;
    document.getElementById('referenceId').value = wallet.reference;
    
    if (wallet.qrCode) {
        document.getElementById('qrPreview').innerHTML = `<img src="${wallet.qrCode}" alt="QR Preview">`;
    }
}

// Delete wallet
function deleteWallet(id) {
    if (confirm('Are you sure you want to delete this wallet?')) {
        wallets = wallets.filter(w => w.id !== id);
        renderWallets();
    }
}

// Handle form submission
function handleFormSubmit(e) {
    e.preventDefault();
    
    const type = document.getElementById('editType').value;
    const editId = document.getElementById('editId').value;
    
    if (type === 'wallet') {
        const walletData = {
            name: document.getElementById('walletName').value,
            icon: 'fas fa-wallet',
            accountName: document.getElementById('accountName').value,
            number: document.getElementById('accountNumber').value,
            reference: document.getElementById('referenceId').value,
            qrCode: document.getElementById('qrPreview').querySelector('img')?.src || ''
        };
        
        if (editId) {
            // Update existing wallet
            const index = wallets.findIndex(w => w.id === parseInt(editId));
            if (index !== -1) {
                wallets[index] = { ...wallets[index], ...walletData };
            }
        } else {
            // Add new wallet
            const newId = wallets.length > 0 ? Math.max(...wallets.map(w => w.id)) + 1 : 1;
            wallets.push({ id: newId, ...walletData });
        }
        
        renderWallets();
    } else if (type === 'bank') {
        bankDetails = {
            qrCode: document.getElementById('bankQrPreview').querySelector('img')?.src || '',
            bank: document.getElementById('bankName').value,
            accountName: document.getElementById('bankAccountName').value,
            accountNo: document.getElementById('bankAccountNo').value,
            branch: document.getElementById('branch').value
        };
        
        renderBankDetails();
    } else if (type === 'cash') {
        cashDetails = {
            title: document.getElementById('cashTitle').value,
            description: document.getElementById('cashDescription').value,
            officeHours: document.getElementById('officeHours').value,
            officeLocation: document.getElementById('officeLocation').value
        };
        
        renderCashDetails();
    } else if (type === 'check') {
        checkDetails = {
            title: document.getElementById('checkTitle').value,
            description: document.getElementById('checkDescription').value,
            payableTo: document.getElementById('payableTo').value,
            instructions: document.getElementById('checkInstructions').value
        };
        
        renderCheckDetails();
    }

    else if (type === 'tutorial') {
    tutorialDetails = {
        title: document.getElementById('tutorialTitle').value,
        uploadInstructions: document.getElementById('uploadInstructions').value,
        walletInstructions: document.getElementById('walletInstructions').value,
        bankInstructions: document.getElementById('bankInstructions').value,
        additionalNotes: document.getElementById('additionalNotes').value
    };
    
        renderTutorialDetails();
    }
    
    closeModal();
}

// Preview uploaded image
function previewImage(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const previewId = input.id === 'qrUpload' ? 'qrPreview' : 'bankQrPreview';
            document.getElementById(previewId).innerHTML = `<img src="${e.target.result}" alt="QR Preview">`;
        };
        reader.readAsDataURL(file);
    }
}

// Close modal when clicking outside
document.getElementById('modal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});