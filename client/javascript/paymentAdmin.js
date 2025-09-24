import fetchCompanyDetails from "../api/loadCompanyInfo.js";

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

//Data structure with payment history
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
                chargeId: 3,
                amount: 1200,
                paymentDate: '2025-01-08',
                paymentMethod: 'Bank Transfer',
                reference: 'BT-2025-0108-001',
                description: 'Water Bill - December 2024',
                type: 'utility',
                processedBy: 'Admin User',
                notes: 'Payment processed successfully via bank transfer'
            },
            {
                id: 'pay-2',
                chargeId: 25, // Previous month rent
                amount: 25000,
                paymentDate: '2024-12-05',
                paymentMethod: 'Online Banking',
                reference: 'OB-2024-1205-002',
                description: 'Monthly Rent - December 2024',
                type: 'rent',
                processedBy: 'System Auto',
                notes: 'Automatic payment processed on time'
            },
            {
                id: 'pay-3',
                chargeId: 26, // Previous utility
                amount: 3200,
                paymentDate: '2024-12-12',
                paymentMethod: 'Cash',
                reference: 'CASH-2024-1212-003',
                description: 'Electricity - November 2024',
                type: 'utility',
                processedBy: 'Front Desk',
                notes: 'Cash payment received at office'
            },
            {
                id: 'pay-4',
                chargeId: 30, // Older payment
                amount: 25000,
                paymentDate: '2024-11-05',
                paymentMethod: 'Check',
                reference: 'CHK-2024-1105-004',
                description: 'Monthly Rent - November 2024',
                type: 'rent',
                processedBy: 'Admin User',
                notes: 'Check cleared successfully'
            }
        ],
        charges: [
            { 
                id: 1, 
                type: 'rent', 
                description: 'Monthly Rent - January 2025', 
                amount: 25000, 
                dueDate: '2025-01-05', 
                status: 'active',
                created: '2024-12-28',
                notes: 'Monthly rental payment for Unit 201-A for January 2025. Includes base rent and common area maintenance.'
            },
            { 
                id: 2, 
                type: 'utility', 
                description: 'Electricity - December 2024', 
                amount: 3500, 
                dueDate: '2025-01-10', 
                status: 'pending',
                created: '2024-12-30',
                notes: 'Electricity consumption for December 2024 - 450 kWh usage. Higher than usual due to holiday season.'
            },
            { 
                id: 3, 
                type: 'utility', 
                description: 'Water Bill - December 2024', 
                amount: 1200, 
                dueDate: '2025-01-10', 
                status: 'paid',
                created: '2024-12-30',
                notes: 'Water consumption for December 2024 - 25 cubic meters. Normal usage pattern.'
            },
            { 
                id: 4, 
                type: 'maintenance', 
                description: 'AC Unit Repair', 
                amount: 4500, 
                dueDate: '2025-01-15', 
                status: 'active',
                created: '2025-01-02',
                notes: 'Emergency repair of AC unit in living room. Parts and labor included. Compressor replacement required.'
            },
            { 
                id: 11, 
                type: 'utility', 
                description: 'Internet Service - January 2025', 
                amount: 1500, 
                dueDate: '2025-01-20', 
                status: 'active',
                created: '2025-01-01',
                notes: 'Monthly internet service fee for January 2025. High-speed fiber connection.'
            },
            { 
                id: 12, 
                type: 'maintenance', 
                description: 'Elevator Maintenance Fee', 
                amount: 800, 
                dueDate: '2025-01-25', 
                status: 'pending',
                created: '2025-01-03',
                notes: 'Monthly elevator maintenance contribution for building upkeep.'
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
                paymentMethod: 'Check',
                reference: 'CHK-2025-0103-005',
                description: 'Monthly Rent - January 2025',
                type: 'rent',
                processedBy: 'Admin User',
                notes: 'Payment received on time'
            },
            {
                id: 'pay-6',
                chargeId: 27, // Previous month
                amount: 18500,
                paymentDate: '2024-12-08',
                paymentMethod: 'Bank Transfer',
                reference: 'BT-2024-1208-006',
                description: 'Monthly Rent - December 2024 (Late Payment)',
                type: 'rent',
                processedBy: 'System Auto',
                notes: 'Late payment with penalty waived'
            },
            {
                id: 'pay-7',
                chargeId: 31,
                amount: 2500,
                paymentDate: '2024-11-15',
                paymentMethod: 'Online Banking',
                reference: 'OB-2024-1115-007',
                description: 'Electricity - October 2024',
                type: 'utility',
                processedBy: 'System Auto',
                notes: 'Online payment processed'
            }
        ],
        charges: [
            { 
                id: 5, 
                type: 'rent', 
                description: 'Monthly Rent - January 2025', 
                amount: 18500, 
                dueDate: '2025-01-05', 
                status: 'paid',
                created: '2024-12-28',
                notes: 'Monthly rental payment for Unit 305-B for January 2025. Payment received on time.'
            },
            { 
                id: 6, 
                type: 'utility', 
                description: 'Electricity - December 2024', 
                amount: 2800, 
                dueDate: '2025-01-10', 
                status: 'active',
                created: '2024-12-30',
                notes: 'Electricity consumption for December 2024 - 380 kWh usage. Within normal range.'
            },
            { 
                id: 7, 
                type: 'penalty', 
                description: 'Late Payment Fee - December', 
                amount: 500, 
                dueDate: '2025-01-05', 
                status: 'pending',
                created: '2025-01-06',
                notes: 'Late payment penalty for December rent payment (5 days overdue). Standard 2.5% penalty rate applied.'
            },
            { 
                id: 13, 
                type: 'utility', 
                description: 'Gas Bill - December 2024', 
                amount: 900, 
                dueDate: '2025-01-12', 
                status: 'active',
                created: '2024-12-31',
                notes: 'Gas consumption for heating and cooking in December 2024.'
            },
            { 
                id: 14, 
                type: 'maintenance', 
                description: 'Plumbing Check', 
                amount: 2500, 
                dueDate: '2025-01-18', 
                status: 'pending',
                created: '2025-01-04',
                notes: 'Routine plumbing inspection and minor repairs in bathroom.'
            }
        ]
    },
    {
        id: 'lease-3',
        tenant: 'Ana Rodriguez',
        unit: 'Unit 102-C',
        period: 'Jun 2024 - May 2025',
        email: 'ana.rodriguez@email.com',
        phone: '+63 919 345 6789',
        paymentHistory: [
            {
                id: 'pay-8',
                chargeId: 15,
                amount: 1800,
                paymentDate: '2025-01-09',
                paymentMethod: 'Online Banking',
                reference: 'OB-2025-0109-008',
                description: 'Water Bill - December 2024',
                type: 'utility',
                processedBy: 'System Auto',
                notes: 'Online payment processed automatically'
            },
            {
                id: 'pay-9',
                chargeId: 28, // Previous month
                amount: 22000,
                paymentDate: '2024-11-05',
                paymentMethod: 'Bank Transfer',
                reference: 'BT-2024-1105-009',
                description: 'Monthly Rent - November 2024',
                type: 'rent',
                processedBy: 'Admin User',
                notes: 'Payment received on time'
            },
            {
                id: 'pay-10',
                chargeId: 32,
                amount: 3800,
                paymentDate: '2024-10-12',
                paymentMethod: 'Credit Card',
                reference: 'CC-2024-1012-010',
                description: 'Electricity - September 2024',
                type: 'utility',
                processedBy: 'Online Portal',
                notes: 'Credit card payment processed'
            }
        ],
        charges: [
            { 
                id: 8, 
                type: 'rent', 
                description: 'Monthly Rent - January 2025', 
                amount: 22000, 
                dueDate: '2025-01-05', 
                status: 'pending',
                created: '2024-12-28',
                notes: 'Monthly rental payment for Unit 102-C for January 2025. Tenant requested payment extension.'
            },
            { 
                id: 9, 
                type: 'utility', 
                description: 'Electricity - December 2024', 
                amount: 4200, 
                dueDate: '2025-01-10', 
                status: 'active',
                created: '2024-12-30',
                notes: 'Electricity consumption for December 2024 - 520 kWh usage (high usage). Investigation recommended.'
            },
            { 
                id: 10, 
                type: 'maintenance', 
                description: 'Plumbing Repair - Kitchen', 
                amount: 6800, 
                dueDate: '2025-01-12', 
                status: 'active',
                created: '2025-01-03',
                notes: 'Kitchen sink and pipes repair due to leak. Emergency plumbing service required. Includes pipe replacement and labor.'
            },
            { 
                id: 15, 
                type: 'utility', 
                description: 'Water Bill - December 2024', 
                amount: 1800, 
                dueDate: '2025-01-11', 
                status: 'paid',
                created: '2024-12-30',
                notes: 'Water consumption for December 2024 - 35 cubic meters. Slightly higher than average.'
            },
            { 
                id: 16, 
                type: 'penalty', 
                description: 'Damage Repair Fee', 
                amount: 3200, 
                dueDate: '2025-01-20', 
                status: 'active',
                created: '2025-01-05',
                notes: 'Repair cost for damaged wall in living room. Paint and drywall replacement.'
            },
            { 
                id: 17, 
                type: 'maintenance', 
                description: 'HVAC System Service', 
                amount: 2800, 
                dueDate: '2025-01-22', 
                status: 'pending',
                created: '2025-01-06',
                notes: 'Quarterly HVAC system maintenance and filter replacement.'
            }
        ]
    },
    {
        id: 'lease-4',
        tenant: 'Carlos Mendoza',
        unit: 'Unit 403-D',
        period: 'Sep 2024 - Aug 2025',
        email: 'carlos.mendoza@email.com',
        phone: '+63 920 456 7890',
        paymentHistory: [
            {
                id: 'pay-11',
                chargeId: 19,
                amount: 3800,
                paymentDate: '2025-01-07',
                paymentMethod: 'Credit Card',
                reference: 'CC-2025-0107-011',
                description: 'Electricity - December 2024',
                type: 'utility',
                processedBy: 'Online Portal',
                notes: 'Credit card payment processed successfully'
            },
            {
                id: 'pay-12',
                chargeId: 29, // Previous month
                amount: 28000,
                paymentDate: '2024-12-03',
                paymentMethod: 'Online Banking',
                reference: 'OB-2024-1203-012',
                description: 'Monthly Rent - December 2024',
                type: 'rent',
                processedBy: 'System Auto',
                notes: 'Payment received early'
            }
        ],
        charges: [
            { 
                id: 18, 
                type: 'rent', 
                description: 'Monthly Rent - January 2025', 
                amount: 28000, 
                dueDate: '2025-01-05', 
                status: 'active',
                created: '2024-12-28',
                notes: 'Monthly rental payment for Unit 403-D for January 2025. Premium unit with balcony.'
            },
            { 
                id: 19, 
                type: 'utility', 
                description: 'Electricity - December 2024', 
                amount: 3800, 
                dueDate: '2025-01-10', 
                status: 'paid',
                created: '2024-12-30',
                notes: 'Electricity consumption for December 2024 - 480 kWh usage. Normal for unit size.'
            },
            { 
                id: 20, 
                type: 'utility', 
                description: 'Water Bill - December 2024', 
                amount: 1600, 
                dueDate: '2025-01-10', 
                status: 'active',
                created: '2024-12-30',
                notes: 'Water consumption for December 2024 - 30 cubic meters. Standard usage.'
            },
            { 
                id: 21, 
                type: 'maintenance', 
                description: 'Balcony Door Repair', 
                amount: 5500, 
                dueDate: '2025-01-14', 
                status: 'pending',
                created: '2025-01-02',
                notes: 'Sliding balcony door mechanism repair and weatherproofing.'
            }
        ]
    },
    {
        id: 'lease-5',
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
                paymentMethod: 'Bank Transfer',
                reference: 'BT-2025-0102-013',
                description: 'Monthly Rent - January 2025',
                type: 'rent',
                processedBy: 'System Auto',
                notes: 'Payment received early'
            },
            {
                id: 'pay-14',
                chargeId: 24,
                amount: 1200,
                paymentDate: '2025-01-10',
                paymentMethod: 'Online Banking',
                reference: 'OB-2025-0110-014',
                description: 'Pool Access Fee',
                type: 'maintenance',
                processedBy: 'System Auto',
                notes: 'Monthly amenity fee paid'
            }
        ],
        charges: [
            { 
                id: 22, 
                type: 'rent', 
                description: 'Monthly Rent - January 2025', 
                amount: 32000, 
                dueDate: '2025-01-05', 
                status: 'paid',
                created: '2024-12-28',
                notes: 'Monthly rental payment for Unit 501-E for January 2025. Penthouse unit with city view.'
            },
            { 
                id: 23, 
                type: 'utility', 
                description: 'Electricity - December 2024', 
                amount: 4500, 
                dueDate: '2025-01-10', 
                status: 'active',
                created: '2024-12-30',
                notes: 'Electricity consumption for December 2024 - 550 kWh usage. High due to larger unit size.'
            },
            { 
                id: 24, 
                type: 'maintenance', 
                description: 'Pool Access Fee', 
                amount: 1200, 
                dueDate: '2025-01-15', 
                status: 'paid',
                created: '2025-01-01',
                notes: 'Monthly pool and gym access fee for premium amenities.'
            }
        ]
    }
];

let filteredData = [...leasesData];
let currentChargeDetails = null;
let currentEditingCharge = null;

// Create modals and confirmation dialogs dynamically
function createModalsAndDialogs() {
    const existingModals = document.querySelector('#edit-charge-modal');
    if (existingModals) return; // Already created

    const modalsHTML = `
        <!-- Edit Charge Modal -->
        <div class="modal" id="edit-charge-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-edit"></i>
                        Edit Charge
                    </h2>
                    <button class="close-btn" onclick="closeModal('edit-charge-modal')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" id="edit-charge-form">
                    <!-- Dynamic edit form will be loaded here -->
                </div>
            </div>
        </div>

        <!-- Payment Details Modal -->
        <div class="modal" id="payment-details-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-receipt"></i>
                        Payment Details
                    </h2>
                    <button class="close-btn" onclick="closeModal('payment-details-modal')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" id="modal-payment-details">
                    <!-- Dynamic payment details will be loaded here -->
                </div>
            </div>
        </div>

        <!-- Confirmation Dialog -->
        <div class="modal confirmation-dialog" id="confirmation-dialog">
            <div class="modal-content confirmation-content">
                <div class="confirmation-icon" id="confirmation-icon">
                    <i class="fas fa-question-circle"></i>
                </div>
                <div class="confirmation-message" id="confirmation-message">
                    Are you sure you want to proceed?
                </div>
                <div class="confirmation-buttons">
                    <button class="btn btn-secondary" id="confirmation-cancel">Cancel</button>
                    <button class="btn btn-primary" id="confirmation-confirm">Confirm</button>
                </div>
            </div>
        </div>

        <!-- Success Dialog -->
        <div class="modal success-dialog" id="success-dialog">
            <div class="modal-content success-content">
                <div class="success-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="success-message" id="success-message">
                    Operation completed successfully!
                </div>
                <div class="success-buttons">
                    <button class="btn btn-primary" onclick="closeModal('success-dialog')">OK</button>
                </div>
            </div>
        </div>
    `;

    // Add modal styles
    const modalStyles = `
        <style>
        /* Enhanced Modal Styles */
        .confirmation-dialog .modal-content,
        .success-dialog .modal-content {
            max-width: 500px;
            text-align: center;
            padding: 0;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 25px 50px rgba(0,0,0,0.25);
        }

        .confirmation-content {
            padding: 40px 30px 40px;
        }

        .success-content {
            padding: 40px 30px 40px;
        }

        .confirmation-icon {
            font-size: 48px;
            margin-bottom: 20px;
            color: #f59e0b;
        }

        .confirmation-icon.danger {
            color: #ef4444;
        }

        .confirmation-icon.success {
            color: #10b981;
        }

        .success-icon {
            font-size: 64px;
            margin-bottom: 20px;
            color: #10b981;
            animation: successPulse 0.6s ease-in-out;
        }

        @keyframes successPulse {
            0% { transform: scale(0); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }

        .confirmation-message {
            font-size: 15px;
            font-weight: 500;
            color: #374151;
            margin-bottom: 25px;
            line-height: 1.6;
            text-align: left;
        }

        .charge-details-in-confirmation {
            background: #f8fafc;
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
            text-align: left;
        }

        .charge-details-in-confirmation div {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            align-items: center;
        }

        .charge-details-in-confirmation div:last-child {
            margin-bottom: 0;
        }

        .charge-details-in-confirmation strong {
            color: #374151;
            font-weight: 600;
        }

        .charge-details-in-confirmation span {
            color: #6b7280;
            font-weight: 500;
        }

        .success-message {
            font-size: 16px;
            font-weight: 500;
            color: #374151;
            margin-bottom: 25px;
            line-height: 1.5;
        }

        .confirmation-buttons {
            display: flex;
            gap: 10px;
            justify-content: center;
            flex-wrap: wrap;
        }

        .success-buttons {
            display: flex;
            justify-content: center;
        }

        .btn-secondary {
            background: #6b7280;
            color: white;
            border: 2px solid #6b7280;
        }

        .btn-secondary:hover {
            background: #4b5563;
            border-color: #4b5563;
        }

        .btn-danger {
            background: linear-gradient(135deg, #ef4444, #dc2626);
            color: white;
            box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
        }

        .btn-danger:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 16px rgba(239, 68, 68, 0.4);
        }

        /* Payment History Styles */
        .payment-history-section {
            margin-top: 20px;
            border-top: 2px solid #e5e7eb;
            padding-top: 20px;
        }

        .payment-history-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            flex-wrap: wrap;
            gap: 10px;
        }

        .payment-history-title {
            font-size: 16px;
            font-weight: 600;
            color: #374151;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .payment-summary {
            font-size: 12px;
            color: #6b7280;
            background: #f8fafc;
            padding: 6px 12px;
            border-radius: 20px;
            border: 1px solid #e5e7eb;
        }

        .payment-history-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-bottom: 0;
        }

        .payment-history-table th {
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            padding: 10px 8px;
            text-align: left;
            font-weight: 600;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }

        .payment-history-table td {
            padding: 10px 8px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 11px;
            vertical-align: middle;
        }

        .payment-history-table tbody tr:hover {
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
        }

        .payment-method-badge {
            background: linear-gradient(135deg, #dbeafe, #bfdbfe);
            color: #1e40af;
            padding: 3px 8px;
            border-radius: 10px;
            font-size: 9px;
            font-weight: 600;
            text-transform: uppercase;
            white-space: nowrap;
        }

        .payment-method-badge.cash {
            background: linear-gradient(135deg, #fef3c7, #fde68a);
            color: #92400e;
        }

        .payment-method-badge.card {
            background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
            color: #3730a3;
        }

        .payment-reference {
            font-family: 'Courier New', monospace;
            font-size: 10px;
            color: #6b7280;
            background: #f8fafc;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid #e5e7eb;
        }

        /* Mobile Payment History */
        .payment-history-mobile {
            display: none;
        }

        .payment-card {
            background: #f8fafc;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 10px;
            border-left: 4px solid #10b981;
            border: 1px solid #e5e7eb;
        }

        .payment-card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 8px;
            flex-wrap: wrap;
            gap: 6px;
        }

        .payment-card-description {
            font-weight: 600;
            color: #1f2937;
            font-size: 12px;
            flex: 1;
        }

        .payment-card-amount {
            font-weight: 700;
            color: #10b981;
            font-size: 14px;
        }

        .payment-card-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            font-size: 11px;
            margin-bottom: 8px;
        }

        .payment-card-detail {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .payment-card-actions {
            text-align: center;
            padding-top: 8px;
            border-top: 1px solid #e5e7eb;
        }

        /* Edit Form Styles */
        .edit-form {
            display: grid;
            gap: 20px;
        }

        .form-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .form-group label {
            font-size: 12px;
            font-weight: 600;
            color: #374151;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
            padding: 12px 16px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            background: white;
            font-size: 14px;
            font-family: 'Poppins', sans-serif;
            transition: all 0.3s ease;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-group textarea {
            resize: vertical;
            min-height: 100px;
        }

        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }

        .form-actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            margin-top: 10px;
        }

        .tenant-info-box {
            background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
            border: 1px solid #bae6fd;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
        }

        .tenant-info-title {
            font-size: 14px;
            font-weight: 600;
            color: #0369a1;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .tenant-details {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
            font-size: 12px;
        }

        .tenant-detail {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
        }

        .tenant-detail-label {
            color: #075985;
            font-weight: 500;
        }

        .tenant-detail-value {
            color: #0c4a6e;
            font-weight: 600;
        }

        @media (max-width: 768px) {
            .form-row {
                grid-template-columns: 1fr;
            }

            .confirmation-dialog .modal-content,
            .success-dialog .modal-content {
                max-width: calc(100vw - 40px);
                margin: 10px;
            }

            .form-actions {
                flex-direction: column;
            }

            .tenant-details {
                grid-template-columns: 1fr;
            }

            .payment-history-table {
                display: none;
            }

            .payment-history-mobile {
                display: block;
            }

            .payment-history-header {
                flex-direction: column;
                align-items: stretch;
                gap: 8px;
            }

            .payment-card-details {
                grid-template-columns: 1fr;
            }
        }
        </style>
    `;

    // Add styles to head
    document.head.insertAdjacentHTML('beforeend', modalStyles);

    // Add modals to body
    document.body.insertAdjacentHTML('beforeend', modalsHTML);
}

// DOM manipulation functions
function renderLeaseCards() {
    const container = document.getElementById('lease-cards');
    
    if (filteredData.length === 0) {
        showEmptyState();
        return;
    }

    hideEmptyState();
    
    container.innerHTML = filteredData.map(lease => {
        const totalCharges = lease.charges.reduce((sum, charge) => sum + charge.amount, 0);
        const chargesCount = lease.charges.length;
        const paymentCount = lease.paymentHistory ? lease.paymentHistory.length : 0;
        const totalPaid = lease.paymentHistory ? lease.paymentHistory.reduce((sum, payment) => sum + payment.amount, 0) : 0;

        return `
            <div class="lease-card fade-in" data-lease="${lease.id}">
                <div class="lease-header">
                    <div class="lease-info">
                        <div class="lease-detail">
                            <div class="lease-detail-label">Tenant</div>
                            <div class="lease-detail-value">${lease.tenant}</div>
                        </div>
                        <div class="lease-detail">
                            <div class="lease-detail-label">Unit</div>
                            <div class="lease-detail-value">${lease.unit}</div>
                        </div>
                        <div class="lease-detail">
                            <div class="lease-detail-label">Lease Period</div>
                            <div class="lease-detail-value">${lease.period}</div>
                        </div>
                    </div>
                    <div class="lease-summary">
                        <div class="total-charges">Total Charges: ₱${totalCharges.toLocaleString()}</div>
                        <div class="charges-count">${chargesCount} charge${chargesCount !== 1 ? 's' : ''}</div>
                    </div>
                </div>

                <!-- Desktop Table View -->
                <div class="charges-table-container">
                    <div class="charges-table-wrapper">
                        <table class="charges-table">
                            <thead>
                                <tr>
                                    <th><i class="fas fa-tag"></i> Type</th>
                                    <th><i class="fas fa-file-alt"></i> Description</th>
                                    <th><i class="fas fa-peso-sign"></i> Amount</th>
                                    <th><i class="fas fa-calendar"></i> Due Date</th>
                                    <th><i class="fas fa-check-circle"></i> Status</th>
                                    <th><i class="fas fa-cogs"></i> Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${lease.charges.map(charge => `
                                    <tr>
                                        <td><span class="charge-type-badge ${charge.type}">${capitalizeFirst(charge.type)}</span></td>
                                        <td title="${charge.description}">${charge.description}</td>
                                        <td>₱${charge.amount.toLocaleString()}</td>
                                        <td>${formatDate(charge.dueDate)}</td>
                                        <td><span class="status-badge ${charge.status}">${capitalizeFirst(charge.status)}</span></td>
                                        <td>
                                            <div class="action-buttons">
                                                <button class="btn btn-info btn-sm" onclick="viewChargeDetails(${charge.id})" title="View Details">
                                                    <i class="fas fa-eye"></i> View
                                                </button>
                                                ${charge.status !== 'paid' ? `
                                                    <button class="btn btn-warning btn-sm" onclick="editCharge(${charge.id})" title="Edit Charge">
                                                        <i class="fas fa-edit"></i> Edit
                                                    </button>
                                                ` : ''}
                                                ${charge.type === 'penalty' || charge.status === 'pending' ? `
                                                    <button class="btn btn-danger btn-sm" onclick="removeCharge(${charge.id})" title="Remove Charge">
                                                        <i class="fas fa-trash"></i>
                                                    </button>
                                                ` : ''}
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Mobile Card View -->
                <div class="charges-mobile-view">
                    ${lease.charges.map(charge => `
                        <div class="charge-card">
                            <div class="charge-card-header">
                                <div class="charge-card-title">${charge.description}</div>
                                <div class="charge-card-amount">₱${charge.amount.toLocaleString()}</div>
                            </div>
                            <div class="charge-card-details">
                                <div class="charge-card-detail">
                                    <span>Type:</span>
                                    <span class="charge-type-badge ${charge.type}">${capitalizeFirst(charge.type)}</span>
                                </div>
                                <div class="charge-card-detail">
                                    <span>Due:</span>
                                    <span>${formatDate(charge.dueDate)}</span>
                                </div>
                                <div class="charge-card-detail">
                                    <span>Status:</span>
                                    <span class="status-badge ${charge.status}">${capitalizeFirst(charge.status)}</span>
                                </div>
                                <div class="charge-card-detail" style="grid-column: 1 / -1;">
                                    <span>Days until due:</span>
                                    <span>${getDaysUntilDueText(charge.dueDate)}</span>
                                </div>
                            </div>
                            <div class="charge-card-actions">
                                <button class="btn btn-info btn-sm" onclick="viewChargeDetails(${charge.id})">
                                    <i class="fas fa-eye"></i> View
                                </button>
                                ${charge.status !== 'paid' ? `
                                    <button class="btn btn-warning btn-sm" onclick="editCharge(${charge.id})">
                                        <i class="fas fa-edit"></i> Edit
                                    </button>
                                ` : ''}
                                ${charge.type === 'penalty' || charge.status === 'pending' ? `
                                    <button class="btn btn-danger btn-sm" onclick="removeCharge(${charge.id})">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Payment History Section -->
                ${lease.paymentHistory && lease.paymentHistory.length > 0 ? `
                    <div class="payment-history-section">
                        <div class="payment-history-header">
                            <div class="payment-history-title">
                                <i class="fas fa-history"></i>
                                Payment History
                            </div>
                            <div class="payment-summary">
                                ${paymentCount} payment${paymentCount !== 1 ? 's' : ''} • Total: ₱${totalPaid.toLocaleString()}
                            </div>
                        </div>

                        <!-- Desktop Payment History Table -->
                        <div class="charges-table-wrapper">
                            <table class="payment-history-table">
                                <thead>
                                    <tr>
                                        <th><i class="fas fa-calendar"></i> Date</th>
                                        <th><i class="fas fa-file-alt"></i> Description</th>
                                        <th><i class="fas fa-peso-sign"></i> Amount</th>
                                        <th><i class="fas fa-credit-card"></i> Method</th>
                                        <th><i class="fas fa-hashtag"></i> Reference</th>
                                        <th><i class="fas fa-user"></i> By</th>
                                        <th><i class="fas fa-cogs"></i> Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${lease.paymentHistory.map(payment => `
                                        <tr>
                                            <td>${formatDate(payment.paymentDate)}</td>
                                            <td title="${payment.description}">${payment.description}</td>
                                            <td style="font-weight: 600; color: #10b981;">₱${payment.amount.toLocaleString()}</td>
                                            <td><span class="payment-method-badge ${getPaymentMethodClass(payment.paymentMethod)}">${payment.paymentMethod}</span></td>
                                            <td><span class="payment-reference">${payment.reference}</span></td>
                                            <td style="font-size: 10px; color: #6b7280;">${payment.processedBy}</td>
                                            <td>
                                                <button class="btn btn-info btn-sm" onclick="viewPaymentDetails('${payment.id}')" title="View Payment Details">
                                                    <i class="fas fa-eye"></i> View
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>

                        <!-- Mobile Payment History -->
                        <div class="payment-history-mobile">
                            ${lease.paymentHistory.map(payment => `
                                <div class="payment-card">
                                    <div class="payment-card-header">
                                        <div class="payment-card-description">${payment.description}</div>
                                        <div class="payment-card-amount">₱${payment.amount.toLocaleString()}</div>
                                    </div>
                                    <div class="payment-card-details">
                                        <div class="payment-card-detail">
                                            <span>Date:</span>
                                            <span>${formatDate(payment.paymentDate)}</span>
                                        </div>
                                        <div class="payment-card-detail">
                                            <span>Method:</span>
                                            <span class="payment-method-badge ${getPaymentMethodClass(payment.paymentMethod)}">${payment.paymentMethod}</span>
                                        </div>
                                        <div class="payment-card-detail">
                                            <span>Reference:</span>
                                            <span class="payment-reference">${payment.reference}</span>
                                        </div>
                                        <div class="payment-card-detail">
                                            <span>Processed by:</span>
                                            <span>${payment.processedBy}</span>
                                        </div>
                                    </div>
                                    <div class="payment-card-actions">
                                        <button class="btn btn-info btn-sm" onclick="viewPaymentDetails('${payment.id}')">
                                            <i class="fas fa-eye"></i> View Details
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : `
                    <div class="payment-history-section">
                        <div class="payment-history-header">
                            <div class="payment-history-title">
                                <i class="fas fa-history"></i>
                                Payment History
                            </div>
                        </div>
                        <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 14px;">
                            <i class="fas fa-inbox" style="font-size: 24px; margin-bottom: 8px; opacity: 0.5;"></i>
                            <p>No payment history available for this lease.</p>
                        </div>
                    </div>
                `}
            </div>
        `;
    }).join('');

    // Add staggered animation
    const cards = container.querySelectorAll('.lease-card');
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
    });
}

function updateStatistics() {
    const allCharges = leasesData.flatMap(lease => lease.charges);
    
    const stats = {
        total: allCharges.length,
        rent: allCharges.filter(charge => charge.type === 'rent').length,
        utility: allCharges.filter(charge => charge.type === 'utility').length,
        maintenance: allCharges.filter(charge => charge.type === 'maintenance').length
    };

    document.getElementById('total-charges').textContent = stats.total;
    document.getElementById('monthly-charges').textContent = stats.rent;
    document.getElementById('utility-charges').textContent = stats.utility;
    document.getElementById('maintenance-charges').textContent = stats.maintenance;
}

// Filter functions
function filterLeases() {
    const searchTerm = document.getElementById('search-filter').value.toLowerCase();
    const typeFilter = document.getElementById('type-filter').value;
    const statusFilter = document.getElementById('status-filter').value;
    const monthFilter = document.getElementById('month-filter').value;

    filteredData = leasesData.filter(lease => {
        // Search filter
        const matchesSearch = !searchTerm || 
            lease.tenant.toLowerCase().includes(searchTerm) ||
            lease.unit.toLowerCase().includes(searchTerm);

        // Type and status filters - check if lease has matching charges
        const matchesType = !typeFilter || 
            lease.charges.some(charge => charge.type === typeFilter);

        const matchesStatus = !statusFilter || 
            lease.charges.some(charge => charge.status === statusFilter);

        // Date filter - check if lease has charges in selected month
        const matchesDate = !monthFilter || 
            lease.charges.some(charge => {
                const chargeDue = new Date(charge.dueDate);
                const filterDate = new Date(monthFilter + '-01');
                return chargeDue.getFullYear() === filterDate.getFullYear() &&
                       chargeDue.getMonth() === filterDate.getMonth();
            });

        return matchesSearch && matchesType && matchesStatus && matchesDate;
    });

    renderLeaseCards();
}

function filterByType(type) {
    document.getElementById('type-filter').value = type;
    filterLeases();
    showAlert(type ? `Filtered by ${capitalizeFirst(type)} charges` : 'Showing all charges', 'success');
}

function resetFilters() {
    document.getElementById('search-filter').value = '';
    document.getElementById('type-filter').value = '';
    document.getElementById('status-filter').value = '';
    document.getElementById('month-filter').value = getCurrentMonth();
    
    filteredData = [...leasesData];
    renderLeaseCards();
    showAlert('All filters cleared', 'success');
}

function toggleFilters() {
    const filterGrid = document.getElementById('filter-grid');
    filterGrid.classList.toggle('active');
    
    // Update button text/icon
    const toggleBtn = document.querySelector('.filter-toggle');
    if (filterGrid.classList.contains('active')) {
        toggleBtn.innerHTML = '<i class="fas fa-times"></i> Hide Filters';
    } else {
        toggleBtn.innerHTML = '<i class="fas fa-filter"></i> Filters & Search';
    }
}

// Modal functions
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.classList.add('modal-open');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
    }
}

// Close modal when clicking outside
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        closeModal(e.target.id);
    }
});

// Handle escape key for modals
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal.active');
        if (openModal) {
            closeModal(openModal.id);
        }
    }
});

// Enhanced Confirmation Dialog
function showConfirmation(options) {
    const {
        title = "Confirm Action",
        message = "Are you sure you want to proceed?",
        confirmText = "Confirm",
        cancelText = "Cancel",
        type = "warning", // warning, danger, success
        chargeDetails = null,
        onConfirm,
        onCancel
    } = options;

    createModalsAndDialogs(); // Ensure modals exist

    const modal = document.getElementById('confirmation-dialog');
    const icon = document.getElementById('confirmation-icon');
    const messageEl = document.getElementById('confirmation-message');
    const confirmBtn = document.getElementById('confirmation-confirm');
    const cancelBtn = document.getElementById('confirmation-cancel');

    // Set icon based on type
    icon.className = `confirmation-icon ${type}`;
    if (type === 'danger') {
        icon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
        confirmBtn.className = 'btn btn-danger';
    } else if (type === 'success') {
        icon.innerHTML = '<i class="fas fa-check-circle"></i>';
        confirmBtn.className = 'btn btn-success';
    } else {
        icon.innerHTML = '<i class="fas fa-question-circle"></i>';
        confirmBtn.className = 'btn btn-primary';
    }

    // Set content
    let messageContent = `<div style="text-align: center; margin-bottom: 15px;">${message}</div>`;
    
    if (chargeDetails) {
        messageContent += `
            <div class="charge-details-in-confirmation">
                <div><strong>Type:</strong> <span>${chargeDetails.type}</span></div>
                <div><strong>Amount:</strong> <span>${chargeDetails.amount}</span></div>
                <div><strong>Description:</strong> <span>${chargeDetails.description}</span></div>
                <div><strong>Tenant:</strong> <span>${chargeDetails.tenant}</span></div>
            </div>
        `;
    }
    
    messageEl.innerHTML = messageContent;
    confirmBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;

    // Set event handlers
    confirmBtn.onclick = () => {
        closeModal('confirmation-dialog');
        if (onConfirm) onConfirm();
    };

    cancelBtn.onclick = () => {
        closeModal('confirmation-dialog');
        if (onCancel) onCancel();
    };

    openModal('confirmation-dialog');
}

// Success Dialog
function showSuccess(message) {
    createModalsAndDialogs(); // Ensure modals exist
    
    const messageEl = document.getElementById('success-message');
    messageEl.textContent = message;
    openModal('success-dialog');
}

// Payment Details Function
function viewPaymentDetails(paymentId) {
    const payment = findPaymentById(paymentId);
    const lease = findLeaseByPaymentId(paymentId);
    
    if (!payment || !lease) {
        showAlert('Payment not found', 'error');
        return;
    }

    const modalBody = document.getElementById('modal-payment-details');
    modalBody.innerHTML = `
        <div class="charge-detail-grid">
            <div>
                <div class="detail-item">
                    <span class="detail-label">Payment Date:</span>
                    <span class="detail-value">${formatDate(payment.paymentDate)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Amount:</span>
                    <span class="detail-value" style="color: #10b981; font-weight: 700;">₱${payment.amount.toLocaleString()}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Payment Method:</span>
                    <span class="detail-value">
                        <span class="payment-method-badge ${getPaymentMethodClass(payment.paymentMethod)}">${payment.paymentMethod}</span>
                    </span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Reference Number:</span>
                    <span class="detail-value">
                        <span class="payment-reference">${payment.reference}</span>
                    </span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Processed By:</span>
                    <span class="detail-value">${payment.processedBy}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Charge Type:</span>
                    <span class="detail-value">
                        <span class="charge-type-badge ${payment.type}">${capitalizeFirst(payment.type)}</span>
                    </span>
                </div>
            </div>
        </div>

        <div style="margin-top: 25px;">
            <h4 style="margin-bottom: 15px; color: #374151; font-size: 16px;">Tenant Information</h4>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <div class="detail-item" style="border-bottom: none; margin-bottom: 8px;">
                    <span class="detail-label">Name:</span>
                    <span class="detail-value">${lease.tenant}</span>
                </div>
                <div class="detail-item" style="border-bottom: none; margin-bottom: 8px;">
                    <span class="detail-label">Unit:</span>
                    <span class="detail-value">${lease.unit}</span>
                </div>
                <div class="detail-item" style="border-bottom: none; margin-bottom: 8px;">
                    <span class="detail-label">Email:</span>
                    <span class="detail-value">${lease.email}</span>
                </div>
                <div class="detail-item" style="border-bottom: none;">
                    <span class="detail-label">Phone:</span>
                    <span class="detail-value">${lease.phone}</span>
                </div>
            </div>
        </div>

        <div style="margin-top: 20px;">
            <h4 style="margin-bottom: 15px; color: #374151; font-size: 16px;">Payment Description & Notes</h4>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
                <p style="color: #1f2937; line-height: 1.6; margin-bottom: 12px; font-weight: 500;">
                    ${payment.description}
                </p>
                <p style="color: #6b7280; line-height: 1.6; font-size: 14px;">
                    ${payment.notes}
                </p>
            </div>
        </div>

        <div style="margin-top: 20px;">
            <h4 style="margin-bottom: 15px; color: #374151; font-size: 16px;">Payment Status</h4>
            <div style="background: #dcfce7; padding: 15px; border-radius: 8px;">
                <p style="color: #166534; font-size: 14px; margin-bottom: 8px;">
                    <i class="fas fa-check-circle"></i> Payment completed successfully
                </p>
                <p style="font-size: 12px; font-weight: 500; color: #059669;">
                    Payment processed on ${formatDate(payment.paymentDate)}
                </p>
            </div>
        </div>
    `;

    openModal('payment-details-modal');
}

// Charge management functions
function viewChargeDetails(chargeId) {
    const charge = findChargeById(chargeId);
    const lease = findLeaseByChargeId(chargeId);
    
    if (!charge || !lease) {
        showAlert('Charge not found', 'error');
        return;
    }

    currentChargeDetails = { charge, lease };

    const modalBody = document.getElementById('modal-charge-details');
    modalBody.innerHTML = `
        <div class="charge-detail-grid">
            <div>
                <div class="detail-item">
                    <span class="detail-label">Charge Type:</span>
                    <span class="detail-value">
                        <span class="charge-type-badge ${charge.type}">${capitalizeFirst(charge.type)}</span>
                    </span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Amount:</span>
                    <span class="detail-value">₱${charge.amount.toLocaleString()}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Due Date:</span>
                    <span class="detail-value">${formatDate(charge.dueDate)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value">
                        <span class="status-badge ${charge.status}">${capitalizeFirst(charge.status)}</span>
                    </span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Created:</span>
                    <span class="detail-value">${formatDate(charge.created)}</span>
                </div>
            </div>
        </div>

        <div style="margin-top: 25px;">
            <h4 style="margin-bottom: 15px; color: #374151; font-size: 16px;">Tenant Information</h4>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <div class="detail-item" style="border-bottom: none; margin-bottom: 8px;">
                    <span class="detail-label">Name:</span>
                    <span class="detail-value">${lease.tenant}</span>
                </div>
                <div class="detail-item" style="border-bottom: none; margin-bottom: 8px;">
                    <span class="detail-label">Unit:</span>
                    <span class="detail-value">${lease.unit}</span>
                </div>
                <div class="detail-item" style="border-bottom: none; margin-bottom: 8px;">
                    <span class="detail-label">Email:</span>
                    <span class="detail-value">${lease.email}</span>
                </div>
                <div class="detail-item" style="border-bottom: none;">
                    <span class="detail-label">Phone:</span>
                    <span class="detail-value">${lease.phone}</span>
                </div>
            </div>
        </div>

        <div style="margin-top: 20px;">
            <h4 style="margin-bottom: 15px; color: #374151; font-size: 16px;">Description & Notes</h4>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
                <p style="color: #1f2937; line-height: 1.6; margin-bottom: 12px; font-weight: 500;">
                    ${charge.description}
                </p>
                <p style="color: #6b7280; line-height: 1.6; font-size: 14px;">
                    ${charge.notes}
                </p>
            </div>
        </div>

        <div style="margin-top: 20px;">
            <h4 style="margin-bottom: 15px; color: #374151; font-size: 16px;">Payment Status</h4>
            <div style="background: ${charge.status === 'paid' ? '#dcfce7' : charge.status === 'pending' ? '#fef3c7' : '#fee2e2'}; padding: 15px; border-radius: 8px;">
                ${charge.status === 'paid' ? 
                    '<p style="color: #166534; font-size: 14px; margin-bottom: 8px;"><i class="fas fa-check-circle"></i> Payment completed successfully</p>' :
                    charge.status === 'pending' ? 
                        '<p style="color: #92400e; font-size: 14px; margin-bottom: 8px;"><i class="fas fa-clock"></i> Payment pending review</p>' :
                        '<p style="color: #991b1b; font-size: 14px; margin-bottom: 8px;"><i class="fas fa-exclamation-triangle"></i> Payment overdue</p>'
                }
                ${getDaysUntilDue(charge.dueDate)}
            </div>
        </div>

        ${charge.status !== 'paid' ? `
            <div style="margin-top: 25px; display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;">
                <button class="btn btn-warning" onclick="editCharge(${charge.id}); closeModal('charge-details-modal');">
                    <i class="fas fa-edit"></i> Edit Charge
                </button>
                ${charge.type === 'penalty' || charge.status === 'pending' ? `
                    <button class="btn btn-danger" onclick="removeCharge(${charge.id}); closeModal('charge-details-modal');">
                        <i class="fas fa-trash"></i> Remove Charge
                    </button>
                ` : ''}
                <button class="btn btn-success" onclick="markAsPaid(${charge.id})">
                    <i class="fas fa-check"></i> Mark as Paid
                </button>
            </div>
        ` : ''}
    `;

    openModal('charge-details-modal');
}

// Enhanced Edit Charge Function
function editCharge(chargeId) {
    const charge = findChargeById(chargeId);
    const lease = findLeaseByChargeId(chargeId);
    
    if (!charge || !lease) {
        showAlert('Charge not found', 'error');
        return;
    }

    currentEditingCharge = { charge, lease };
    createModalsAndDialogs(); // Ensure modals exist

    const modalBody = document.getElementById('edit-charge-form');
    modalBody.innerHTML = `
        <div class="tenant-info-box">
            <div class="tenant-info-title">
                <i class="fas fa-user"></i>
                Editing charge for ${lease.tenant}
            </div>
            <div class="tenant-details">
                <div class="tenant-detail">
                    <span class="tenant-detail-label">Unit:</span>
                    <span class="tenant-detail-value">${lease.unit}</span>
                </div>
                <div class="tenant-detail">
                    <span class="tenant-detail-label">Email:</span>
                    <span class="tenant-detail-value">${lease.email}</span>
                </div>
                <div class="tenant-detail">
                    <span class="tenant-detail-label">Phone:</span>
                    <span class="tenant-detail-value">${lease.phone}</span>
                </div>
            </div>
        </div>

        <form class="edit-form" id="edit-charge-form-element" onsubmit="saveChargeChanges(event)">
            <div class="form-row">
                <div class="form-group">
                    <label for="edit-charge-type">
                        <i class="fas fa-tag"></i> Charge Type
                    </label>
                    <select id="edit-charge-type" name="type" required>
                        <option value="rent" ${charge.type === 'rent' ? 'selected' : ''}>Rent</option>
                        <option value="utility" ${charge.type === 'utility' ? 'selected' : ''}>Utility</option>
                        <option value="maintenance" ${charge.type === 'maintenance' ? 'selected' : ''}>Maintenance</option>
                        <option value="penalty" ${charge.type === 'penalty' ? 'selected' : ''}>Penalty</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="edit-charge-status">
                        <i class="fas fa-check-circle"></i> Status
                    </label>
                    <select id="edit-charge-status" name="status" required>
                        <option value="active" ${charge.status === 'active' ? 'selected' : ''}>Active</option>
                        <option value="pending" ${charge.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="paid" ${charge.status === 'paid' ? 'selected' : ''}>Paid</option>
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label for="edit-charge-description">
                    <i class="fas fa-file-alt"></i> Description
                </label>
                <input type="text" id="edit-charge-description" name="description" 
                       value="${charge.description}" required 
                       placeholder="Enter charge description">
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="edit-charge-amount">
                        <i class="fas fa-peso-sign"></i> Amount (₱)
                    </label>
                    <input type="number" id="edit-charge-amount" name="amount" 
                           value="${charge.amount}" min="0" step="0.01" required 
                           placeholder="0.00">
                </div>
                
                <div class="form-group">
                    <label for="edit-charge-due-date">
                        <i class="fas fa-calendar"></i> Due Date
                    </label>
                    <input type="date" id="edit-charge-due-date" name="dueDate" 
                           value="${charge.dueDate}" required>
                </div>
            </div>

            <div class="form-group">
                <label for="edit-charge-notes">
                    <i class="fas fa-sticky-note"></i> Notes
                </label>
                <textarea id="edit-charge-notes" name="notes" 
                          placeholder="Additional notes or comments about this charge...">${charge.notes}</textarea>
            </div>

            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal('edit-charge-modal')">
                    <i class="fas fa-times"></i> Cancel
                </button>
                <button type="submit" class="btn btn-success">
                    <i class="fas fa-save"></i> Save Changes
                </button>
            </div>
        </form>
    `;

    openModal('edit-charge-modal');
}

// Save Charge Changes Function
function saveChargeChanges(event) {
    event.preventDefault();

    if (!currentEditingCharge) {
        showAlert('No charge selected for editing', 'error');
        return;
    }

    const formData = new FormData(event.target);
    const updatedData = {
        type: formData.get('type'),
        description: formData.get('description'),
        amount: parseFloat(formData.get('amount')),
        dueDate: formData.get('dueDate'),
        status: formData.get('status'),
        notes: formData.get('notes')
    };

    // Validate data
    if (!updatedData.description.trim()) {
        showAlert('Description is required', 'error');
        return;
    }

    if (updatedData.amount <= 0) {
        showAlert('Amount must be greater than zero', 'error');
        return;
    }

    showConfirmation({
        title: "Save Changes",
        message: `Are you sure you want to save the changes to this charge?`,
        confirmText: "SAVE CHANGES",
        cancelText: "CANCEL",
        type: "success",
        chargeDetails: {
            type: capitalizeFirst(updatedData.type),
            amount: `₱${updatedData.amount.toLocaleString()}`,
            description: updatedData.description,
            tenant: `${currentEditingCharge.lease.tenant} (${currentEditingCharge.lease.unit})`
        },
        onConfirm: () => {
            // Update the charge
            Object.assign(currentEditingCharge.charge, updatedData);

            // Update displays
            filteredData = [...leasesData];
            renderLeaseCards();
            updateStatistics();
            closeModal('edit-charge-modal');

            showSuccess(`Charge updated successfully! The ${updatedData.type} charge has been saved with the new details.`);
            renderGeneralPaymentHistory();

            currentEditingCharge = null;
        },
        onCancel: () => {
            // Do nothing, just close confirmation
        }
    });
}

function removeCharge(chargeId) {
    const charge = findChargeById(chargeId);
    const lease = findLeaseByChargeId(chargeId);
    
    if (!charge || !lease) {
        showAlert('Charge not found', 'error');
        return;
    }

    showConfirmation({
        title: "Delete Charge",
        message: `Are you sure you want to delete this charge? This action cannot be undone.`,
        confirmText: "DELETE CHARGE",
        cancelText: "KEEP CHARGE",
        type: "danger",
        chargeDetails: {
            type: capitalizeFirst(charge.type),
            amount: `₱${charge.amount.toLocaleString()}`,
            description: charge.description,
            tenant: `${lease.tenant} (${lease.unit})`
        },
        onConfirm: () => {
            // Find and remove the charge
            for (let lease of leasesData) {
                const chargeIndex = lease.charges.findIndex(charge => charge.id === chargeId);
                if (chargeIndex !== -1) {
                    lease.charges.splice(chargeIndex, 1);
                    break;
                }
            }

            // Update display
            filteredData = [...leasesData];
            renderLeaseCards();
            updateStatistics();

            showSuccess(`Charge deleted successfully! The ${charge.type} charge for ₱${charge.amount.toLocaleString()} has been removed.`);
            renderGeneralPaymentHistory();
        },
        onCancel: () => {
            showAlert('Charge deletion cancelled', 'success');
        }
    });
}

function markAsPaid(chargeId) {
    const charge = findChargeById(chargeId);
    const lease = findLeaseByChargeId(chargeId);
    
    if (!charge || !lease) {
        showAlert('Charge not found', 'error');
        return;
    }

    showConfirmation({
        title: "Mark as Paid",
        message: `Are you sure you want to mark this charge as paid?`,
        confirmText: "MARK AS PAID",
        cancelText: "CANCEL",
        type: "success",
        chargeDetails: {
            type: capitalizeFirst(charge.type),
            amount: `₱${charge.amount.toLocaleString()}`,
            description: charge.description,
            tenant: `${lease.tenant} (${lease.unit})`
        },
        onConfirm: () => {
            charge.status = 'paid';
            
            // Add payment to history
            if (!lease.paymentHistory) {
                lease.paymentHistory = [];
            }
            
            const newPayment = {
                id: `pay-${Date.now()}`,
                chargeId: charge.id,
                amount: charge.amount,
                paymentDate: new Date().toISOString().split('T')[0],
                paymentMethod: 'Manual Entry',
                reference: `MAN-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 1000)}`,
                description: charge.description,
                type: charge.type,
                processedBy: 'Admin User',
                notes: 'Payment marked as paid manually through admin interface'
            };
            
            lease.paymentHistory.unshift(newPayment);
            
            renderLeaseCards();
            updateStatistics();
            closeModal('charge-details-modal');

            showSuccess(`Payment recorded successfully! The ${charge.type} charge for ₱${charge.amount.toLocaleString()} has been marked as paid.`);
            renderGeneralPaymentHistory();
        },
        onCancel: () => {
            // Do nothing
        }
    });
}

function exportChargesData() {
    showConfirmation({
        title: "Export Data",
        message: "Do you want to export all charges data to a file?<br><br>This will include all lease information, charges, and payment details.",
        confirmText: "Export Data",
        cancelText: "Cancel",
        type: "success",
        onConfirm: () => {
            showAlert('Preparing export...', 'success');
            
            // Simulate export process
            setTimeout(() => {
                const dataToExport = {
                    exportDate: new Date().toISOString(),
                    totalLeases: leasesData.length,
                    totalCharges: leasesData.flatMap(lease => lease.charges).length,
                    totalPayments: leasesData.flatMap(lease => lease.paymentHistory || []).length,
                    leases: leasesData
                };

                // In a real application, this would generate and download a file
                console.log('Export data:', dataToExport);
                showSuccess('Charges and payment data exported successfully! The file has been prepared and will be downloaded shortly.');
            }, 2000);
        },
        onCancel: () => {
            showAlert('Export cancelled', 'success');
        }
    });
}

// Utility functions
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

function getPaymentMethodClass(method) {
    const methodLower = method.toLowerCase();
    if (methodLower.includes('cash')) return 'cash';
    if (methodLower.includes('card') || methodLower.includes('credit')) return 'card';
    return 'default';
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getDaysUntilDue(dueDateStr) {
    const dueDate = new Date(dueDateStr);
    const today = new Date();
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
        return `<p style="font-size: 12px; font-weight: 500;">Due in ${diffDays} day${diffDays !== 1 ? 's' : ''}</p>`;
    } else if (diffDays === 0) {
        return '<p style="font-size: 12px; font-weight: 500; color: #f59e0b;">Due today</p>';
    } else {
        return `<p style="font-size: 12px; font-weight: 500; color: #ef4444;">Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''}</p>`;
    }
}

function getDaysUntilDueText(dueDateStr) {
    const dueDate = new Date(dueDateStr);
    const today = new Date();
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    } else if (diffDays === 0) {
        return 'Today';
    } else {
        return `Overdue ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''}`;
    }
}

function showEmptyState() {
    const container = document.getElementById('lease-cards');
    container.innerHTML = `
        <div class="empty-state" id="empty-state">
            <i class="fas fa-search"></i>
            <h3>No charges found</h3>
            <p>Try adjusting your search criteria or filters to see more results.</p>
            <button class="btn btn-primary" onclick="resetFilters()">
                <i class="fas fa-refresh"></i> Clear All Filters
            </button>
        </div>
    `;
}

function hideEmptyState() {
    const emptyState = document.getElementById('empty-state');
    if (emptyState && emptyState.parentNode) {
        emptyState.parentNode.removeChild(emptyState);
    }
}

// Enhanced alert system following existing patterns
function showAlert(message, type) {
    // Create and show alert following existing alert patterns
    const alert = document.createElement('div');
    alert.className = `notification ${type}`;
    
    // Set background color based on type
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    alert.style.background = colors[type] || colors.info;
    
    alert.innerHTML = `<i class="fas fa-${
        type === 'success' ? 'check-circle' : 
        type === 'error' ? 'exclamation-triangle' : 
        type === 'warning' ? 'exclamation-circle' : 'info-circle'
    }"></i> ${message}`;

    // Insert into body
    document.body.appendChild(alert);

    // Remove after 4 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.style.animation = 'slideOutRight 0.3s ease forwards';
            setTimeout(() => alert.remove(), 300);
        }
    }, 4000);
}

// Add new charge functionality (for the "Add Charges" button)
function addNewCharge() {
    showConfirmation({
        title: "Add New Charge",
        message: "Do you want to add a new charge? You will be redirected to the charge creation form.",
        confirmText: "Add Charge",
        cancelText: "Cancel",
        type: "success",
        onConfirm: () => {
            // In a real application, this would navigate to the add charge form
            window.location.href = '/add-charges.html';
        },
        onCancel: () => {
            // Do nothing
        }
    });
}

let currentPaymentFilter = 'all';

// Enhanced function to render general payment history
function renderGeneralPaymentHistory() {
    const allCharges = [];
    
    // Collect all charges with tenant info
    leasesData.forEach(lease => {
        lease.charges.forEach(charge => {
            allCharges.push({
                ...charge,
                tenant: lease.tenant,
                unit: lease.unit,
                email: lease.email,
                phone: lease.phone,
                leaseId: lease.id
            });
        });
    });

    // Filter based on current tab selection
    let filteredCharges = filterChargesByStatus(allCharges, currentPaymentFilter);

    // Sort by priority (overdue first, then by due date)
    filteredCharges.sort((a, b) => {
        const aDaysUntilDue = getDaysUntilDueNumber(a.dueDate);
        const bDaysUntilDue = getDaysUntilDueNumber(b.dueDate);
        
        // Overdue charges first
        if (aDaysUntilDue < 0 && bDaysUntilDue >= 0) return -1;
        if (bDaysUntilDue < 0 && aDaysUntilDue >= 0) return 1;
        
        // Then by due date
        return new Date(a.dueDate) - new Date(b.dueDate);
    });

    // Update statistics
    updatePaymentStatistics(allCharges);

    // Render desktop table
    renderPaymentHistoryTable(filteredCharges);

    // Render mobile cards
    renderPaymentHistoryMobile(filteredCharges);
}

function filterChargesByStatus(charges, status) {
    switch (status) {
        case 'overdue':
            return charges.filter(charge => {
                const daysUntilDue = getDaysUntilDueNumber(charge.dueDate);
                return daysUntilDue < 0 && charge.status !== 'paid';
            });
        case 'due-soon':
            return charges.filter(charge => {
                const daysUntilDue = getDaysUntilDueNumber(charge.dueDate);
                return daysUntilDue >= 0 && daysUntilDue <= 7 && charge.status !== 'paid';
            });
        case 'paid':
            return charges.filter(charge => charge.status === 'paid');
        default:
            return charges;
    }
}

function renderPaymentHistoryTable(charges) {
    const tbody = document.getElementById('payment-overview-tbody');
    
    if (charges.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: #6b7280;">
                    <div class="payment-history-empty">
                        <i class="fas fa-inbox" style="font-size: 32px; margin-bottom: 10px; opacity: 0.5;"></i>
                        <p>No charges found for the selected filter.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = charges.map(charge => {
        const daysUntilDue = getDaysUntilDueNumber(charge.dueDate);
        const statusClass = getChargeStatusClass(charge, daysUntilDue);
        const daysText = getDaysUntilDueFormatted(charge.dueDate, charge.status);

        return `
            <tr class="payment-row ${statusClass}" data-charge-id="${charge.id}">
                <td class="tenant-info-cell">
                    <div class="tenant-name">${charge.tenant}</div>
                    <div class="tenant-email">${charge.email}</div>
                </td>
                <td class="unit-cell">${charge.unit}</td>
                <td>
                    <span class="charge-type-badge ${charge.type}">${capitalizeFirst(charge.type)}</span>
                </td>
                <td class="description-cell" title="${charge.description}">
                    ${charge.description}
                </td>
                <td class="amount-cell ${statusClass}">
                    ₱${charge.amount.toLocaleString()}
                </td>
                <td class="due-date-cell">${formatDate(charge.dueDate)}</td>
                <td>
                    <span class="days-until-due ${getDaysUntilDueClass(charge.dueDate, charge.status)}">
                        ${daysText}
                    </span>
                </td>
                <td>
                    <span class="status-badge ${charge.status}">${capitalizeFirst(charge.status)}</span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-info btn-sm" onclick="viewChargeDetails(${charge.id})" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${charge.status !== 'paid' ? `
                            <button class="btn btn-success btn-sm" onclick="markAsPaid(${charge.id})" title="Mark as Paid">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="btn btn-warning btn-sm" onclick="editCharge(${charge.id})" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderPaymentHistoryMobile(charges) {
    const container = document.getElementById('payment-overview-cards');
    
    if (charges.length === 0) {
        container.innerHTML = `
            <div class="payment-history-empty">
                <i class="fas fa-inbox"></i>
                <h3>No charges found</h3>
                <p>No charges match the selected filter criteria.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = charges.map(charge => {
        const daysUntilDue = getDaysUntilDueNumber(charge.dueDate);
        const statusClass = getChargeStatusClass(charge, daysUntilDue);
        const daysText = getDaysUntilDueFormatted(charge.dueDate, charge.status);

        return `
            <div class="payment-overview-card ${statusClass}" data-charge-id="${charge.id}">
                ${daysUntilDue < 0 && charge.status !== 'paid' ? '<div class="priority-indicator high"></div>' : ''}
                ${daysUntilDue >= 0 && daysUntilDue <= 3 && charge.status !== 'paid' ? '<div class="priority-indicator medium"></div>' : ''}
                
                <div class="payment-card-header">
                    <div class="payment-card-tenant">
                        <div class="payment-card-tenant-name">${charge.tenant}</div>
                        <div class="payment-card-unit">${charge.unit}</div>
                    </div>
                    <div class="payment-card-amount ${statusClass}">
                        ₱${charge.amount.toLocaleString()}
                    </div>
                </div>

                <div class="payment-card-description">
                    ${charge.description}
                </div>

                <div class="payment-card-details">
                    <div class="payment-card-detail">
                        <strong>Type:</strong>
                        <span class="charge-type-badge ${charge.type}">${capitalizeFirst(charge.type)}</span>
                    </div>
                    <div class="payment-card-detail">
                        <strong>Due Date:</strong>
                        <span>${formatDate(charge.dueDate)}</span>
                    </div>
                    <div class="payment-card-detail">
                        <strong>Status:</strong>
                        <span class="status-badge ${charge.status}">${capitalizeFirst(charge.status)}</span>
                    </div>
                    <div class="payment-card-detail">
                        <strong>Days:</strong>
                        <span class="days-until-due ${getDaysUntilDueClass(charge.dueDate, charge.status)}">
                            ${daysText}
                        </span>
                    </div>
                </div>

                <div class="payment-card-actions">
                    <button class="btn btn-info btn-sm" onclick="viewChargeDetails(${charge.id})">
                        <i class="fas fa-eye"></i> View
                    </button>
                    ${charge.status !== 'paid' ? `
                        <button class="btn btn-success btn-sm" onclick="markAsPaid(${charge.id})">
                            <i class="fas fa-check"></i> Pay
                        </button>
                        <button class="btn btn-warning btn-sm" onclick="editCharge(${charge.id})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function updatePaymentStatistics(allCharges) {
    const stats = {
        paid: 0,
        overdue: 0,
        pending: 0
    };

    allCharges.forEach(charge => {
        if (charge.status === 'paid') {
            stats.paid++;
        } else {
            const daysUntilDue = getDaysUntilDueNumber(charge.dueDate);
            if (daysUntilDue < 0) {
                stats.overdue++;
            } else {
                stats.pending++;
            }
        }
    });

    document.getElementById('paid-count').textContent = stats.paid;
    document.getElementById('overdue-count').textContent = stats.overdue;
    document.getElementById('pending-count').textContent = stats.pending;
}

function filterPaymentHistory(status) {
    currentPaymentFilter = status;
    
    // Update active tab
    document.querySelectorAll('.payment-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-status="${status}"]`).classList.add('active');
    
    // Re-render with new filter
    renderGeneralPaymentHistory();
    
    // Show feedback
    const filterText = {
        'all': 'all charges',
        'overdue': 'overdue charges',
        'due-soon': 'charges due soon',
        'paid': 'paid charges'
    };
    
    showAlert(`Showing ${filterText[status]}`, 'success');
}

// Utility functions for payment history
function getDaysUntilDueNumber(dueDateStr) {
    const dueDate = new Date(dueDateStr);
    const today = new Date();
    const diffTime = dueDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getChargeStatusClass(charge, daysUntilDue) {
    if (charge.status === 'paid') return 'paid';
    if (daysUntilDue < 0) return 'overdue';
    if (daysUntilDue <= 7) return 'due-soon';
    return 'future';
}

function getDaysUntilDueClass(dueDateStr, status) {
    if (status === 'paid') return 'paid';
    
    const daysUntilDue = getDaysUntilDueNumber(dueDateStr);
    if (daysUntilDue < 0) return 'overdue';
    if (daysUntilDue === 0) return 'due-today';
    if (daysUntilDue <= 7) return 'due-soon';
    return 'future';
}

function getDaysUntilDueFormatted(dueDateStr, status) {
    if (status === 'paid') return 'Paid';
    
    const daysUntilDue = getDaysUntilDueNumber(dueDateStr);
    if (daysUntilDue < 0) {
        return `${Math.abs(daysUntilDue)}d overdue`;
    } else if (daysUntilDue === 0) {
        return 'Due today';
    } else if (daysUntilDue <= 7) {
        return `${daysUntilDue}d left`;
    } else {
        return `${daysUntilDue} days`;
    }
}

// Make the filter function globally available
window.filterPaymentHistory = filterPaymentHistory;

// Make functions available globally for onclick handlers
window.filterLeases = filterLeases;
window.filterByType = filterByType;
window.resetFilters = resetFilters;
window.toggleFilters = toggleFilters;
window.viewChargeDetails = viewChargeDetails;
window.viewPaymentDetails = viewPaymentDetails;
window.editCharge = editCharge;
window.saveChargeChanges = saveChargeChanges;
window.removeCharge = removeCharge;
window.markAsPaid = markAsPaid;
window.exportChargesData = exportChargesData;
window.addNewCharge = addNewCharge;
window.closeModal = closeModal;
window.showConfirmation = showConfirmation;
window.showSuccess = showSuccess;

// Initialize the page
document.addEventListener("DOMContentLoaded", function () {
    // Create modals and dialogs
    createModalsAndDialogs();
    
    
    // Set current month in filter
    const monthFilter = document.getElementById('month-filter');
    if (monthFilter) {
        monthFilter.value = getCurrentMonth();
    }

    // Update the "Add Charges" button to use confirmation
    const addChargesBtn = document.querySelector('button[onclick*="add-charges.html"]');
    if (addChargesBtn) {
        addChargesBtn.setAttribute('onclick', 'addNewCharge()');
    }

    // Initial render
    renderLeaseCards();
    updateStatistics();
    renderGeneralPaymentHistory();
});