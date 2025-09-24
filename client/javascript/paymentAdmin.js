import fetchCompanyDetails from "../utils/loadCompanyInfo.js";

async function setDynamicInfo() {
  const company = await fetchCompanyDetails();
  if (!company) return;

  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon && company.icon_logo_url) {
    favicon.href = company.icon_logo_url;
  }

  document.title = company.company_name
    ? `Charges by Lease - ${company.company_name}`
    : "Charges by Lease";
}

document.addEventListener("DOMContentLoaded", () => {
  setDynamicInfo();
});

// Enhanced data structure combining both systems
const leasesData = [
    {
        id: 'lease-1',
        tenant: 'Maria Santos',
        unit: 'Unit 201-A',
        period: 'Jan 2025 - Dec 2025',
        email: 'maria.santos@email.com',
        phone: '+63 917 123 4567',
        paymentHistory: [
            {
                id: 'pay-1',
                chargeId: 25,
                amount: 2800,
                paymentDate: '2025-01-08',
                paymentMethod: 'gcash',
                reference: 'GC-2025-0108-001',
                description: 'Electricity - November 2024',
                type: 'utility',
                processedBy: 'Admin User',
                notes: 'Payment processed successfully via GCash'
            },
            {
                id: 'pay-2',
                chargeId: 26,
                amount: 25000,
                paymentDate: '2025-01-05',
                paymentMethod: 'cash',
                reference: 'CSH-2025-0105-002',
                description: 'Monthly Rent - December 2024',
                type: 'rent',
                processedBy: 'Admin User',
                notes: 'Cash payment received on time'
            }
        ],
        charges: [
            { 
                id: 1, 
                type: 'rent', 
                description: 'Monthly Rent - January 2025', 
                amount: 25000, 
                dueDate: '2025-01-05', 
                status: 'overdue',
                createdDate: '2024-12-28',
                notes: 'Monthly rental payment for Unit 201-A for January 2025. Payment is now overdue.'
            },
            { 
                id: 2, 
                type: 'utility', 
                description: 'Electricity - December 2024', 
                amount: 3200, 
                dueDate: '2025-01-15', 
                status: 'due-soon',
                createdDate: '2024-12-30',
                notes: 'Electricity consumption for December 2024 - 420 kWh usage. Due soon.'
            },
            { 
                id: 3, 
                type: 'maintenance', 
                description: 'AC Unit Repair', 
                amount: 4500, 
                dueDate: '2025-01-20', 
                status: 'pending',
                createdDate: '2025-01-02',
                notes: 'Emergency repair of AC unit in living room. Parts and labor included.'
            },
            { 
                id: 4, 
                type: 'penalty', 
                description: 'Late Payment Fee - December Rent', 
                amount: 500, 
                dueDate: '2025-01-05', 
                status: 'overdue',
                createdDate: '2024-12-20',
                notes: 'Late payment penalty for December rent (5 days overdue). 2.5% penalty rate.'
            }
        ]
    },
    {
        id: 'lease-2',
        tenant: 'Juan Dela Cruz',
        unit: 'Unit 305-B',
        period: 'Mar 2024 - Feb 2025',
        email: 'juan.delacruz@email.com',
        phone: '+63 918 234 5678',
        paymentHistory: [
            {
                id: 'pay-5',
                chargeId: 5,
                amount: 18500,
                paymentDate: '2025-01-03',
                paymentMethod: 'cash',
                reference: 'CSH-2025-0103-005',
                description: 'Monthly Rent - January 2025',
                type: 'rent',
                processedBy: 'Admin User',
                notes: 'Cash payment received on time'
            },
            {
                id: 'pay-6',
                chargeId: 27,
                amount: 2400,
                paymentDate: '2025-01-10',
                paymentMethod: 'gcash',
                reference: 'GC-2025-0110-006',
                description: 'Water Bill - December 2024',
                type: 'utility',
                processedBy: 'System Auto',
                notes: 'GCash payment processed successfully'
            }
        ],
        charges: [
            { 
                id: 6, 
                type: 'utility', 
                description: 'Electricity - December 2024', 
                amount: 2800, 
                dueDate: '2025-01-18', 
                status: 'due-soon',
                createdDate: '2024-12-30',
                notes: 'Electricity consumption for December 2024 - 380 kWh usage. Due soon.'
            },
            { 
                id: 7, 
                type: 'rent', 
                description: 'Monthly Rent - February 2025', 
                amount: 18500, 
                dueDate: '2025-02-05', 
                status: 'pending',
                createdDate: '2025-01-28',
                notes: 'Monthly rental payment for Unit 305-B for February 2025.'
            }
        ]
    },
    {
        id: 'lease-3',
        tenant: 'Elena Fernandez',
        unit: 'Unit 501-E',
        period: 'Nov 2024 - Oct 2025',
        email: 'elena.fernandez@email.com',
        phone: '+63 921 567 8901',
        paymentHistory: [
            {
                id: 'pay-13',
                chargeId: 22,
                amount: 32000,
                paymentDate: '2025-01-02',
                paymentMethod: 'gcash',
                reference: 'GC-2025-0102-013',
                description: 'Monthly Rent - January 2025',
                type: 'rent',
                processedBy: 'System Auto',
                notes: 'GCash payment received early'
            },
            {
                id: 'pay-14',
                chargeId: 28,
                amount: 1200,
                paymentDate: '2025-01-08',
                paymentMethod: 'cash',
                reference: 'CSH-2025-0108-014',
                description: 'Plumbing Repair - Kitchen Sink',
                type: 'maintenance',
                processedBy: 'Admin User',
                notes: 'Emergency plumbing repair completed and paid in cash'
            }
        ],
        charges: [
            { 
                id: 23, 
                type: 'utility', 
                description: 'Electricity - December 2024', 
                amount: 4500, 
                dueDate: '2025-01-12', 
                status: 'overdue',
                createdDate: '2024-12-30',
                notes: 'Electricity consumption for December 2024 - 550 kWh usage. Payment is overdue.'
            },
            { 
                id: 24, 
                type: 'maintenance', 
                description: 'Elevator Maintenance Fee', 
                amount: 800, 
                dueDate: '2025-01-25', 
                status: 'pending',
                createdDate: '2025-01-05',
                notes: 'Monthly elevator maintenance fee for penthouse access.'
            }
        ]
    },
    {
        id: 'lease-4',
        tenant: 'Robert Chen',
        unit: 'Unit 102-C',
        period: 'Jun 2024 - May 2025',
        email: 'robert.chen@email.com',
        phone: '+63 922 678 9012',
        paymentHistory: [
            {
                id: 'pay-15',
                chargeId: 29,
                amount: 22000,
                paymentDate: '2024-12-28',
                paymentMethod: 'gcash',
                reference: 'GC-2024-1228-015',
                description: 'Monthly Rent - December 2024',
                type: 'rent',
                processedBy: 'Admin User',
                notes: 'GCash payment received early for end of year'
            }
        ],
        charges: [
            { 
                id: 8, 
                type: 'rent', 
                description: 'Monthly Rent - January 2025', 
                amount: 22000, 
                dueDate: '2025-01-03', 
                status: 'overdue',
                createdDate: '2024-12-28',
                notes: 'Monthly rental payment for Unit 102-C. Payment is significantly overdue.'
            },
            { 
                id: 9, 
                type: 'utility', 
                description: 'Water Bill - December 2024', 
                amount: 800, 
                dueDate: '2025-01-16', 
                status: 'due-soon',
                createdDate: '2024-12-30',
                notes: 'Water consumption for December 2024. Due soon.'
            },
            { 
                id: 10, 
                type: 'penalty', 
                description: 'Late Payment Fee - January Rent', 
                amount: 1100, 
                dueDate: '2025-01-10', 
                status: 'overdue',
                createdDate: '2025-01-05',
                notes: 'Late payment penalty for January rent (5% penalty rate applied).'
            }
        ]
    }
];

// Global variables
let filteredCharges = [];
let filteredPayments = [];
let filteredData = [...leasesData];
let editingChargeId = null;
let currentPaymentCharge = null;
let currentViewingCharge = null;
let chargeToDelete = null;
let currentPaymentFilter = 'all';
let currentEditingCharge = null;

// Initialize charges and payments arrays for backward compatibility
let charges = [];
let payments = [];

// Populate backward compatibility arrays
function syncDataArrays() {
    charges = [];
    payments = [];
    
    leasesData.forEach(lease => {
        lease.charges.forEach(charge => {
            if (charge.status !== 'paid') {
                charges.push({
                    ...charge,
                    tenant: lease.tenant,
                    email: lease.email,
                    unit: lease.unit
                });
            }
        });
        
        if (lease.paymentHistory) {
            lease.paymentHistory.forEach(payment => {
                payments.push({
                    ...payment,
                    tenant: lease.tenant,
                    email: lease.email,
                    unit: lease.unit
                });
            });
        }
    });
    
    filteredCharges = [...charges];
    filteredPayments = [...payments];
}

// Utility Functions
function formatCurrency(amount) {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
    });
}

function getDaysUntilDue(dueDate) {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

// Enhanced status determination with explicit status handling
function getChargeStatus(charge) {
    // Use explicit status first if provided
    if (charge.status === 'paid') return 'paid';
    if (charge.status === 'overdue') return 'overdue';
    if (charge.status === 'due-soon') return 'due-soon';
    if (charge.status === 'pending') return 'pending';
    
    // Fallback to date-based calculation
    const daysUntilDue = getDaysUntilDue(charge.dueDate);
    
    if (daysUntilDue < 0) return 'overdue';
    if (daysUntilDue <= 3) return 'due-soon';
    return 'pending';
}

function getStatusDisplay(charge) {
    const status = getChargeStatus(charge);
    const daysUntilDue = getDaysUntilDue(charge.dueDate);
    
    switch (status) {
        case 'overdue':
            return `<span class="status-indicator overdue">
                <i class="fas fa-exclamation-triangle"></i> ${Math.abs(daysUntilDue)} days overdue
            </span>`;
        case 'due-soon':
            return `<span class="status-indicator due-soon">
                <i class="fas fa-clock"></i> Due in ${daysUntilDue} days
            </span>`;
        case 'paid':
            return `<span class="status-indicator paid">
                <i class="fas fa-check-circle"></i> Paid
            </span>`;
        case 'pending':
            return `<span class="status-indicator pending">
                <i class="fas fa-clock"></i> Due in ${daysUntilDue} days
            </span>`;
        default:
            return `<span class="status-indicator pending">
                <i class="fas fa-clock"></i> Pending
            </span>`;
    }
}

function generateReference(method) {
    const prefixes = {
        'cash': 'CSH',
        'gcash': 'GC'
    };
    
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return `${prefixes[method] || 'PAY'}-${dateStr.slice(0, 4)}-${dateStr.slice(4, 8)}-${random}`;
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Alert System
function showAlert(message, type = 'info') {
    const alertColors = {
        success: '#10b981',
        error: '#ef4444', 
        warning: '#f59e0b',
        info: '#3b82f6'
    };

    const alertIcons = {
        success: 'check-circle',
        error: 'exclamation-triangle',
        warning: 'exclamation-circle',
        info: 'info-circle'
    };

    const existingAlerts = document.querySelectorAll('.alert-notification');
    existingAlerts.forEach(alert => alert.remove());

    const alert = document.createElement('div');
    alert.className = 'alert-notification';
    alert.style.background = alertColors[type];
    alert.innerHTML = `
        <i class="fas fa-${alertIcons[type]}"></i>
        ${message}
    `;

    document.body.appendChild(alert);

    setTimeout(() => {
        if (alert.parentNode) {
            alert.style.animation = 'slideOutRight 0.3s ease forwards';
            setTimeout(() => alert.remove(), 300);
        }
    }, 4000);
}

// Statistics calculation
function updateStatistics() {
    syncDataArrays();
    
    const totalCharges = charges.length;
    const overdueCharges = charges.filter(c => getChargeStatus(c) === 'overdue').length;
    const dueSoonCharges = charges.filter(c => getChargeStatus(c) === 'due-soon').length;
    const totalChargesAmount = charges.reduce((sum, c) => sum + c.amount, 0);
    
    const totalPayments = payments.length;
    const totalPaidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    
    // Update main statistics
    const totalElement = document.getElementById('total-charges');
    const overdueElement = document.getElementById('overdue-charges');
    const paidElement = document.getElementById('paid-charges');
    const amountElement = document.getElementById('total-amount');
    
    if (totalElement) totalElement.textContent = totalCharges;
    if (overdueElement) overdueElement.textContent = overdueCharges;
    if (paidElement) paidElement.textContent = totalPayments;
    if (amountElement) amountElement.textContent = formatCurrency(totalChargesAmount);
    
    // Update section stats for charges table
    const activeCharges = charges.filter(c => c.status !== 'paid').length;
    const chargesTotalStat = document.getElementById('charges-total-stat');
    const chargesOverdueStat = document.getElementById('charges-overdue-stat');
    const chargesActiveStat = document.getElementById('charges-active-stat');
    
    if (chargesTotalStat) chargesTotalStat.textContent = `${totalCharges} Total`;
    if (chargesOverdueStat) chargesOverdueStat.textContent = `${overdueCharges} Overdue`;
    if (chargesActiveStat) chargesActiveStat.textContent = `${dueSoonCharges} Due Soon`;
    
    // Update payment stats
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyPayments = payments.filter(p => p.paymentDate.startsWith(currentMonth));
    const monthlyAmount = monthlyPayments.reduce((sum, p) => sum + p.amount, 0);
    
    const paymentsCountStat = document.getElementById('payments-count-stat');
    const paymentsAmountStat = document.getElementById('payments-amount-stat');
    const paymentsMonthStat = document.getElementById('payments-month-stat');
    
    if (paymentsCountStat) paymentsCountStat.textContent = `${totalPayments} Payments`;
    if (paymentsAmountStat) paymentsAmountStat.textContent = `${formatCurrency(totalPaidAmount)} Collected`;
    if (paymentsMonthStat) paymentsMonthStat.textContent = `This Month: ${formatCurrency(monthlyAmount)}`;
}

// Find functions
function findChargeById(chargeId) {
    for (let lease of leasesData) {
        const charge = lease.charges.find(charge => charge.id === chargeId);
        if (charge) return charge;
    }
    return null;
}

function findLeaseByChargeId(chargeId) {
    return leasesData.find(lease => 
        lease.charges.some(charge => charge.id === chargeId)
    );
}

function findPaymentById(paymentId) {
    for (let lease of leasesData) {
        if (lease.paymentHistory) {
            const payment = lease.paymentHistory.find(payment => payment.id === paymentId);
            if (payment) return payment;
        }
    }
    return null;
}

function findLeaseByPaymentId(paymentId) {
    return leasesData.find(lease => 
        lease.paymentHistory && lease.paymentHistory.some(payment => payment.id === paymentId)
    );
}

// Record payment function
function recordPayment(chargeId) {
    const charge = findChargeById(chargeId);
    const lease = findLeaseByChargeId(chargeId);
    
    if (!charge || !lease) {
        showAlert('Charge not found', 'error');
        return;
    }

    currentPaymentCharge = charge;
    document.getElementById('paymentChargeId').value = chargeId;
    document.getElementById('paymentAmount').value = charge.amount;
    document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];
    
    createModalsAndDialogs();
    openModal('paymentModal');
}

// Handle payment submission
function handlePaymentSubmission(event) {
    event.preventDefault();
    
    if (!currentPaymentCharge) {
        showAlert('No charge selected for payment', 'error');
        return;
    }
    
    const formData = new FormData(event.target);
    const paymentData = {
        amount: parseFloat(formData.get('amount')),
        paymentMethod: formData.get('method'),
        reference: formData.get('reference').trim(),
        paymentDate: formData.get('date'),
        notes: 'Payment recorded through admin interface'
    };
    
    // Validation
    if (paymentData.amount <= 0) {
        showAlert('Payment amount must be greater than zero', 'error');
        return;
    }
    
    if (!paymentData.paymentMethod) {
        showAlert('Please select a payment method', 'error');
        return;
    }
    
    // Generate reference if not provided
    if (!paymentData.reference) {
        paymentData.reference = generateReference(paymentData.paymentMethod);
    }
    
    const lease = findLeaseByChargeId(currentPaymentCharge.id);
    const charge = findChargeById(currentPaymentCharge.id);
    
    if (!lease || !charge) {
        showAlert('Charge or lease not found', 'error');
        return;
    }
    
    // Create new payment record
    const newPayment = {
        id: `pay-${Date.now()}`,
        chargeId: currentPaymentCharge.id,
        ...paymentData,
        description: currentPaymentCharge.description,
        type: currentPaymentCharge.type,
        processedBy: 'Admin User'
    };
    
    if (!lease.paymentHistory) {
        lease.paymentHistory = [];
    }
    
    lease.paymentHistory.unshift(newPayment);
    charge.status = 'paid';
    
    syncDataArrays();
    filteredCharges = [...charges];
    filteredPayments = [...payments];
    filteredData = [...leasesData];
    updateStatistics();
    renderChargesTable();
    renderPaymentsTable();
    closeModal('paymentModal');
    
    showAlert(`Payment of ${formatCurrency(paymentData.amount)} recorded successfully! Reference: ${paymentData.reference}`, 'success');
}

// Render functions
function renderChargesTable() {
    const tbody = document.getElementById('charges-tbody');
    const mobileContainer = document.getElementById('charges-mobile');
    
    if (!tbody && !mobileContainer) return;
    
    const unpaidCharges = filteredCharges.filter(charge => charge.status !== 'paid');
    
    if (unpaidCharges.length === 0) {
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8">
                        <div class="empty-state">
                            <i class="fas fa-check-circle" style="color: #10b981;"></i>
                            <h3>No outstanding charges</h3>
                            <p>All charges have been paid or there are no charges to display.</p>
                            <button class="btn btn-primary" onclick="resetChargesFilters()">
                                <i class="fas fa-refresh"></i> Refresh View
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }
        if (mobileContainer) {
            mobileContainer.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle" style="color: #10b981;"></i><h3>No outstanding charges</h3></div>';
        }
        return;
    }
    
    // Desktop table
    if (tbody) {
        tbody.innerHTML = unpaidCharges.map(charge => `
            <tr>
                <td>
                    <div style="font-weight: 600;">${charge.tenant}</div>
                    <div style="font-size: 12px; color: #6b7280;">${charge.email}</div>
                </td>
                <td style="font-weight: 600; color: #3b82f6;">${charge.unit}</td>
                <td><span class="badge ${charge.type}">${charge.type.charAt(0).toUpperCase() + charge.type.slice(1)}</span></td>
                <td>${charge.description}</td>
                <td style="font-weight: 700; color: #ef4444;">${formatCurrency(charge.amount)}</td>
                <td>${formatDate(charge.dueDate)}</td>
                <td>${getStatusDisplay(charge)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-info btn-sm" title="View Details" onclick="viewCharge(${charge.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-success btn-sm" title="Record Payment" onclick="recordPayment(${charge.id})">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-warning btn-sm" title="Edit" onclick="editCharge(${charge.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" title="Remove" onclick="removeCharge(${charge.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    // Mobile cards
    if (mobileContainer) {
        mobileContainer.innerHTML = unpaidCharges.map(charge => `
            <div class="mobile-card charges">
                <div class="card-header">
                    <div>
                        <div class="card-title">${charge.tenant}</div>
                        <div style="font-size: 14px; color: #3b82f6; font-weight: 600;">${charge.unit}</div>
                    </div>
                    <div class="card-amount charge" style="color: #ef4444;">${formatCurrency(charge.amount)}</div>
                </div>
                
                <div class="card-details">
                    <div><strong>Type:</strong> <span class="badge ${charge.type}">${charge.type.charAt(0).toUpperCase() + charge.type.slice(1)}</span></div>
                    <div><strong>Due:</strong> ${formatDate(charge.dueDate)}</div>
                    <div style="grid-column: 1/-1;"><strong>Description:</strong> ${charge.description}</div>
                    <div style="grid-column: 1/-1;"><strong>Status:</strong> ${getStatusDisplay(charge)}</div>
                </div>

                <div class="card-actions">
                    <button class="btn btn-info btn-sm" onclick="viewCharge(${charge.id})">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn btn-success btn-sm" onclick="recordPayment(${charge.id})">
                        <i class="fas fa-check"></i> Pay
                    </button>
                    <button class="btn btn-warning btn-sm" onclick="editCharge(${charge.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </div>
            </div>
        `).join('');
    }
}

function renderPaymentsTable() {
    const tbody = document.getElementById('payments-tbody');
    const mobileContainer = document.getElementById('payments-mobile');
    
    if (!tbody && !mobileContainer) return;
    
    if (filteredPayments.length === 0) {
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8">
                        <div class="empty-state">
                            <i class="fas fa-search"></i>
                            <h3>No payments found</h3>
                            <p>Try adjusting your search criteria or filters to see more results.</p>
                            <button class="btn btn-primary" onclick="resetPaymentsFilters()">
                                <i class="fas fa-refresh"></i> Clear Filters
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }
        if (mobileContainer) {
            mobileContainer.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><h3>No payments found</h3></div>';
        }
        return;
    }
    
    // Desktop table
    if (tbody) {
        tbody.innerHTML = filteredPayments.map(payment => `
            <tr>
                <td>
                    <div style="font-weight: 600;">${payment.tenant}</div>
                    <div style="font-size: 12px; color: #6b7280;">${payment.email}</div>
                </td>
                <td style="font-weight: 600; color: #10b981;">${payment.unit}</td>
                <td>${formatDate(payment.paymentDate)}</td>
                <td>${payment.description}</td>
                <td style="font-weight: 700; color: #10b981;">${formatCurrency(payment.amount)}</td>
                <td><span class="payment-method ${payment.paymentMethod}">${payment.paymentMethod === 'gcash' ? 'GCash' : 'Cash'}</span></td>
                <td style="font-family: monospace; font-size: 12px;">${payment.reference}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-info btn-sm" title="View Receipt" onclick="viewPayment('${payment.id}')">
                            <i class="fas fa-receipt"></i>
                        </button>
                        <button class="btn btn-secondary btn-sm" title="Download PDF" onclick="downloadReceipt('${payment.id}')">
                            <i class="fas fa-download"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    // Mobile cards
    if (mobileContainer) {
        mobileContainer.innerHTML = filteredPayments.map(payment => `
            <div class="mobile-card payments">
                <div class="card-header">
                    <div>
                        <div class="card-title">${payment.tenant}</div>
                        <div style="font-size: 14px; color: #10b981; font-weight: 600;">${payment.unit}</div>
                    </div>
                    <div class="card-amount payment">${formatCurrency(payment.amount)}</div>
                </div>
                
                <div class="card-details">
                    <div><strong>Date:</strong> ${formatDate(payment.paymentDate)}</div>
                    <div><strong>Method:</strong> <span class="payment-method ${payment.paymentMethod}">${payment.paymentMethod === 'gcash' ? 'GCash' : 'Cash'}</span></div>
                    <div style="grid-column: 1/-1;"><strong>Description:</strong> ${payment.description}</div>
                    <div style="grid-column: 1/-1;"><strong>Reference:</strong> <span style="font-family: monospace;">${payment.reference}</span></div>
                </div>

                <div class="card-actions">
                    <button class="btn btn-info btn-sm" onclick="viewPayment('${payment.id}')">
                        <i class="fas fa-receipt"></i> Receipt
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="downloadReceipt('${payment.id}')">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
            </div>
        `).join('');
    }
}

// Filter functions
function filterCharges() {
    const search = document.getElementById('charges-search')?.value.toLowerCase() || '';
    const type = document.getElementById('charges-type')?.value || '';
    const status = document.getElementById('charges-status')?.value || '';
    const date = document.getElementById('charges-date')?.value || '';

    const unpaidCharges = charges.filter(charge => charge.status !== 'paid');
    
    filteredCharges = unpaidCharges.filter(charge => {
        let matches = true;

        if (search) {
            const searchText = `${charge.tenant} ${charge.unit} ${charge.description}`.toLowerCase();
            matches = matches && searchText.includes(search);
        }

        if (type) {
            matches = matches && charge.type === type;
        }

        if (status) {
            const chargeStatus = getChargeStatus(charge);
            matches = matches && chargeStatus === status;
        }

        if (date) {
            const chargeMonth = charge.dueDate.slice(0, 7);
            matches = matches && chargeMonth === date;
        }

        return matches;
    });

    renderChargesTable();
}

function filterPayments() {
    const search = document.getElementById('payments-search')?.value.toLowerCase() || '';
    const method = document.getElementById('payments-method')?.value || '';
    const type = document.getElementById('payments-type')?.value || '';
    const date = document.getElementById('payments-date')?.value || '';

    filteredPayments = payments.filter(payment => {
        let matches = true;

        if (search) {
            const searchText = `${payment.tenant} ${payment.unit} ${payment.description}`.toLowerCase();
            matches = matches && searchText.includes(search);
        }

        if (method) {
            matches = matches && payment.paymentMethod === method;
        }

        if (type) {
            matches = matches && payment.type === type;
        }

        if (date) {
            const paymentMonth = payment.paymentDate.slice(0, 7);
            matches = matches && paymentMonth === date;
        }

        return matches;
    });

    renderPaymentsTable();
}

// Reset filters
function resetChargesFilters() {
    const elements = ['charges-search', 'charges-type', 'charges-status', 'charges-date'];
    elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });
    filteredCharges = charges.filter(charge => charge.status !== 'paid');
    renderChargesTable();
    showAlert('Charges filters cleared', 'success');
}

function resetPaymentsFilters() {
    const elements = ['payments-search', 'payments-method', 'payments-type', 'payments-date'];
    elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });
    filteredPayments = [...payments];
    renderPaymentsTable();
    showAlert('Payment filters cleared', 'success');
}

// Create modals and confirmation dialogs dynamically
function createModalsAndDialogs() {
    const existingModals = document.querySelector('#paymentModal');
    if (existingModals) return;

    const modalsHTML = `
        <!-- Payment Modal -->
        <div id="paymentModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">Record Payment</h2>
                    <span class="close" onclick="closeModal('paymentModal')">&times;</span>
                </div>
                <form id="paymentForm">
                    <div class="form-group">
                        <label for="paymentChargeId">Charge ID</label>
                        <input type="text" id="paymentChargeId" name="chargeId" readonly>
                    </div>
                    <div class="form-group">
                        <label for="paymentAmount">Amount (₱)</label>
                        <input type="number" id="paymentAmount" name="amount" min="0" step="0.01" required>
                    </div>
                    <div class="form-group">
                        <label for="paymentMethod">Payment Method</label>
                        <select id="paymentMethod" name="method" required>
                            <option value="">Select Method</option>
                            <option value="cash">Cash</option>
                            <option value="gcash">GCash</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="paymentReference">Reference Number</label>
                        <input type="text" id="paymentReference" name="reference" placeholder="Leave blank to auto-generate">
                    </div>
                    <div class="form-group">
                        <label for="paymentDate">Payment Date</label>
                        <input type="date" id="paymentDate" name="date" required>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="closeModal('paymentModal')">Cancel</button>
                        <button type="submit" class="btn btn-success">Record Payment</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- View Payment Modal -->
        <div id="viewPaymentModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">Payment Receipt</h2>
                    <span class="close" onclick="closeModal('viewPaymentModal')">&times;</span>
                </div>
                <div class="receipt-content">
                    <div class="receipt-header">
                        <h3>PAYMENT RECEIPT</h3>
                        <div class="receipt-number">Receipt #<span id="receiptNumber"></span></div>
                    </div>
                    
                    <div class="receipt-details">
                        <div class="detail-row">
                            <span class="label">Payment ID:</span>
                            <span id="receiptPaymentId"></span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Date:</span>
                            <span id="receiptDate"></span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Tenant:</span>
                            <span id="receiptTenant"></span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Unit:</span>
                            <span id="receiptUnit"></span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Description:</span>
                            <span id="receiptDescription"></span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Payment Method:</span>
                            <span id="receiptMethod"></span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Reference Number:</span>
                            <span id="receiptReference" class="reference-number"></span>
                        </div>
                        <div class="detail-row total-row">
                            <span class="label">Amount Paid:</span>
                            <span id="receiptAmount" class="amount-paid"></span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Processed By:</span>
                            <span id="receiptProcessedBy"></span>
                        </div>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeModal('viewPaymentModal')">Close</button>
                    <button type="button" class="btn btn-info" onclick="printReceipt()">
                        <i class="fas fa-print"></i> Print Receipt
                    </button>
                    <button type="button" class="btn btn-primary" onclick="downloadReceipt()">
                        <i class="fas fa-download"></i> Download PDF
                    </button>
                </div>
            </div>
        </div>

        <!-- View Charge Modal -->
        <div id="viewChargeModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">Charge Details</h2>
                    <span class="close" onclick="closeModal('viewChargeModal')">&times;</span>
                </div>
                <div class="charge-details-content">
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Charge ID</label>
                            <span id="viewChargeId"></span>
                        </div>
                        <div class="detail-item">
                            <label>Tenant Name</label>
                            <span id="viewChargeTenant"></span>
                        </div>
                        <div class="detail-item">
                            <label>Email</label>
                            <span id="viewChargeEmail"></span>
                        </div>
                        <div class="detail-item">
                            <label>Unit Number</label>
                            <span id="viewChargeUnit"></span>
                        </div>
                        <div class="detail-item">
                            <label>Charge Type</label>
                            <span id="viewChargeType" class="badge"></span>
                        </div>
                        <div class="detail-item">
                            <label>Amount</label>
                            <span id="viewChargeAmount" class="amount-display"></span>
                        </div>
                        <div class="detail-item">
                            <label>Due Date</label>
                            <span id="viewChargeDueDate"></span>
                        </div>
                        <div class="detail-item">
                            <label>Status</label>
                            <span id="viewChargeStatus"></span>
                        </div>
                        <div class="detail-item full-width">
                            <label>Description</label>
                            <span id="viewChargeDescription"></span>
                        </div>
                        <div class="detail-item full-width">
                            <label>Notes</label>
                            <span id="viewChargeNotes"></span>
                        </div>
                        <div class="detail-item">
                            <label>Created Date</label>
                            <span id="viewChargeCreated"></span>
                        </div>
                        <div class="detail-item">
                            <label>Days Until Due</label>
                            <span id="viewChargeDaysUntilDue" class="days-indicator"></span>
                        </div>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeModal('viewChargeModal')">Close</button>
                    <button type="button" class="btn btn-success" onclick="recordPayment(currentViewingCharge.id); closeModal('viewChargeModal');">
                        <i class="fas fa-check"></i> Record Payment
                    </button>
                </div>
            </div>
        </div>
    `;

    // Add enhanced modal styles
    if (!document.querySelector('style[data-modal-styles]')) {
        const modalStyles = document.createElement('style');
        modalStyles.setAttribute('data-modal-styles', 'true');
        modalStyles.textContent = `
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
            backdrop-filter: blur(5px);
        }
        
        .modal-content {
            background: white;
            margin: 5% auto;
            padding: 32px;
            border-radius: 16px;
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            animation: modalSlideIn 0.3s ease-out;
        }
        
        @keyframes modalSlideIn {
            from {
                opacity: 0;
                transform: translateY(-50px) scale(0.9);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 2px solid #f1f5f9;
        }
        
        .modal-title {
            font-size: 24px;
            font-weight: 700;
            color: #1f2937;
        }
        
        .close {
            color: #6b7280;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
            line-height: 1;
            transition: color 0.3s ease;
        }
        
        .close:hover {
            color: #374151;
            transform: scale(1.1);
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #374151;
        }
        
        .form-group input,
        .form-group select {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 14px;
            transition: all 0.3s ease;
        }
        
        .form-group input:focus,
        .form-group select:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        .form-actions {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            margin-top: 32px;
            flex-wrap: wrap;
        }
        
        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            white-space: nowrap;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            color: white;
            box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
        }
        
        .btn-secondary {
            background: #6b7280;
            color: white;
        }
        
        .btn-success {
            background: #10b981;
            color: white;
        }
        
        .btn-info {
            background: #06b6d4;
            color: white;
        }
        
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }
        
        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        
        .receipt-content {
            background: #f8fafc;
            border-radius: 8px;
            padding: 24px;
            margin: 20px 0;
        }
        
        .receipt-header {
            text-align: center;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 16px;
            margin-bottom: 20px;
        }
        
        .receipt-header h3 {
            font-size: 24px;
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 8px;
        }
        
        .receipt-number {
            font-size: 14px;
            color: #6b7280;
            font-weight: 600;
        }
        
        .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .detail-row:last-child {
            border-bottom: none;
        }
        
        .detail-row .label {
            font-weight: 600;
            color: #374151;
            min-width: 140px;
        }
        
        .total-row {
            border-top: 2px solid #3b82f6;
            margin-top: 12px;
            padding-top: 16px;
            font-size: 18px;
            font-weight: 700;
        }
        
        .amount-paid {
            color: #059669;
            font-size: 20px;
            font-weight: 700;
        }
        
        .reference-number {
            font-family: 'Courier New', monospace;
            background: #e0e7ff;
            padding: 4px 8px;
            border-radius: 4px;
            color: #3730a3;
        }
        
        .detail-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .detail-item {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        
        .detail-item.full-width {
            grid-column: 1 / -1;
        }
        
        .detail-item label {
            font-size: 12px;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .detail-item span {
            font-size: 14px;
            font-weight: 500;
            color: #374151;
            padding: 8px 12px;
            background: #f9fafb;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
        }
        
        .amount-display {
            font-size: 18px !important;
            font-weight: 700 !important;
            color: #ef4444 !important;
        }
        
        .days-indicator {
            font-weight: 600 !important;
        }
        
        .days-indicator.overdue {
            color: #dc2626 !important;
            background: #fee2e2 !important;
        }
        
        .days-indicator.due-soon {
            color: #d97706 !important;
            background: #fef3c7 !important;
        }
        
        .payment-method {
            background: #f3f4f6;
            padding: 4px 8px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 600;
            color: #374151;
            border: 1px solid #d1d5db;
            white-space: nowrap;
        }
        
        .payment-method.gcash {
            background: #e0f2fe;
            color: #0369a1;
            border-color: #0284c7;
        }
        
        .payment-method.cash {
            background: #f0fdf4;
            color: #166534;
            border-color: #16a34a;
        }
        
        @media (max-width: 768px) {
            .detail-grid {
                grid-template-columns: 1fr;
            }
            
            .detail-row {
                flex-direction: column;
                align-items: flex-start;
                gap: 4px;
            }
            
            .detail-row .label {
                min-width: unset;
            }
            
            .form-actions {
                flex-direction: column;
            }
            
            .btn {
                justify-content: center;
            }
        }
        `;
        document.head.appendChild(modalStyles);
    }

    document.body.insertAdjacentHTML('beforeend', modalsHTML);
}

// Modal Functions
function openModal(modalId) {
    createModalsAndDialogs();
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        
        if (modalId === 'paymentModal') {
            const form = document.getElementById('paymentForm');
            if (form) form.reset();
            currentPaymentCharge = null;
        }
    }
}

// View functions
function viewCharge(id) {
    const charge = findChargeById(id);
    const lease = findLeaseByChargeId(id);
    
    if (!charge || !lease) {
        showAlert('Charge not found', 'error');
        return;
    }
    
    currentViewingCharge = charge;
    
    document.getElementById('viewChargeId').textContent = charge.id;
    document.getElementById('viewChargeTenant').textContent = lease.tenant;
    document.getElementById('viewChargeEmail').textContent = lease.email;
    document.getElementById('viewChargeUnit').textContent = lease.unit;
    document.getElementById('viewChargeType').textContent = capitalizeFirst(charge.type);
    document.getElementById('viewChargeAmount').textContent = formatCurrency(charge.amount);
    document.getElementById('viewChargeDueDate').textContent = formatDate(charge.dueDate);
    document.getElementById('viewChargeStatus').innerHTML = getStatusDisplay(charge);
    document.getElementById('viewChargeDescription').textContent = charge.description;
    document.getElementById('viewChargeNotes').textContent = charge.notes || 'No additional notes';
    document.getElementById('viewChargeCreated').textContent = formatDate(charge.createdDate);
    
    const daysUntilDue = getDaysUntilDue(charge.dueDate);
    const daysElement = document.getElementById('viewChargeDaysUntilDue');
    if (daysUntilDue < 0) {
        daysElement.textContent = `${Math.abs(daysUntilDue)} days overdue`;
        daysElement.className = 'days-indicator overdue';
    } else if (daysUntilDue <= 3) {
        daysElement.textContent = `${daysUntilDue} days until due`;
        daysElement.className = 'days-indicator due-soon';
    } else {
        daysElement.textContent = `${daysUntilDue} days until due`;
        daysElement.className = 'days-indicator';
    }
    
    openModal('viewChargeModal');
}

function viewPayment(id) {
    const payment = findPaymentById(id);
    const lease = findLeaseByPaymentId(id);
    
    if (!payment || !lease) {
        showAlert('Payment not found', 'error');
        return;
    }
    
    document.getElementById('receiptNumber').textContent = payment.reference;
    document.getElementById('receiptPaymentId').textContent = payment.id;
    document.getElementById('receiptDate').textContent = formatDate(payment.paymentDate);
    document.getElementById('receiptTenant').textContent = lease.tenant;
    document.getElementById('receiptUnit').textContent = lease.unit;
    document.getElementById('receiptDescription').textContent = payment.description;
    document.getElementById('receiptMethod').textContent = payment.paymentMethod === 'gcash' ? 'GCash' : 'Cash';
    document.getElementById('receiptReference').textContent = payment.reference;
    document.getElementById('receiptAmount').textContent = formatCurrency(payment.amount);
    document.getElementById('receiptProcessedBy').textContent = payment.processedBy || 'System';
    
    openModal('viewPaymentModal');
}

// Print and Export Functions
function printReceipt() {
    window.print();
    showAlert('Receipt sent to printer', 'success');
}

function downloadReceipt(paymentId) {
    let payment;
    if (paymentId) {
        payment = findPaymentById(paymentId);
    } else {
        const receiptNumber = document.getElementById('receiptNumber')?.textContent;
        payment = payments.find(p => p.reference === receiptNumber);
    }
    
    if (!payment) {
        showAlert('Payment not found', 'error');
        return;
    }
    
    showAlert('Generating receipt...', 'info');
    
    const receiptData = `PAYMENT RECEIPT
Receipt #: ${payment.reference}
Date: ${formatDate(payment.paymentDate)}
Tenant: ${payment.tenant}
Unit: ${payment.unit}
Description: ${payment.description}
Payment Method: ${payment.paymentMethod === 'gcash' ? 'GCash' : 'Cash'}
Amount Paid: ${formatCurrency(payment.amount)}
Reference: ${payment.reference}
Processed By: ${payment.processedBy || 'System'}`;
    
    const blob = new Blob([receiptData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${payment.reference}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showAlert('Receipt downloaded successfully!', 'success');
}

// Placeholder functions for compatibility
function addNewCharge() { showAlert('Add charge functionality not implemented', 'info'); }
function editCharge(id) { showAlert('Edit charge functionality not implemented', 'info'); }
function removeCharge(id) { showAlert('Remove charge functionality not implemented', 'info'); }
function viewChargeDetails(id) { viewCharge(id); }
function viewPaymentDetails(id) { viewPayment(id); }
function filterLeases() { showAlert('Lease filtering not implemented', 'info'); }
function resetFilters() { resetChargesFilters(); resetPaymentsFilters(); }
function filterByType(type) { 
    const typeFilter = document.getElementById('charges-type');
    if (typeFilter) {
        typeFilter.value = type || '';
        filterCharges();
    }
}
function filterByStatus(status) {
    const statusFilter = document.getElementById('charges-status');
    if (statusFilter) {
        statusFilter.value = status || '';
        filterCharges();
    }
}

// Make functions globally available
window.recordPayment = recordPayment;
window.viewCharge = viewCharge;
window.viewPayment = viewPayment;
window.downloadReceipt = downloadReceipt;
window.filterCharges = filterCharges;
window.filterPayments = filterPayments;
window.resetChargesFilters = resetChargesFilters;
window.resetPaymentsFilters = resetPaymentsFilters;
window.closeModal = closeModal;
window.openModal = openModal;
window.printReceipt = printReceipt;
window.addNewCharge = addNewCharge;
window.editCharge = editCharge;
window.removeCharge = removeCharge;
window.viewChargeDetails = viewChargeDetails;
window.viewPaymentDetails = viewPaymentDetails;
window.filterLeases = filterLeases;
window.resetFilters = resetFilters;
window.filterByType = filterByType;
window.filterByStatus = filterByStatus;

// Initialize the application
document.addEventListener("DOMContentLoaded", function () {
    syncDataArrays();
    
    const paymentForm = document.getElementById('paymentForm');
    if (paymentForm) {
        paymentForm.addEventListener('submit', handlePaymentSubmission);
    }
    
    // Set up filter listeners for charges section
    const chargesFilterInputs = ['charges-search', 'charges-type', 'charges-status', 'charges-date'];
    chargesFilterInputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', filterCharges);
            element.addEventListener('change', filterCharges);
        }
    });
    
    // Set up filter listeners for payments section
    const paymentFilterInputs = ['payments-search', 'payments-method', 'payments-type', 'payments-date'];
    paymentFilterInputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', filterPayments);
            element.addEventListener('change', filterPayments);
        }
    });
    
    // Set up modal close handlers
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
        if (e.target.classList.contains('close')) {
            const modal = e.target.closest('.modal');
            if (modal) closeModal(modal.id);
        }
    });
    
    // Handle escape key for modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const openModal = document.querySelector('.modal[style*="block"]');
            if (openModal) {
                closeModal(openModal.id);
            }
        }
    });
    
    // Initial render
    renderChargesTable();
    renderPaymentsTable();
    updateStatistics();
    
    console.log('Payment Management System initialized');
    console.log('Unpaid charges:', charges.length);
    console.log('Payment history records:', payments.length);
});

export { 
    leasesData, 
    charges, 
    payments, 
    updateStatistics, 
    renderChargesTable, 
    renderPaymentsTable,
    filterCharges,
    filterPayments,
    showAlert,
    formatCurrency,
    formatDate
};