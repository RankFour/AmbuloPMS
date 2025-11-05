const leasesTable = `CREATE TABLE IF NOT EXISTS leases (
    lease_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    property_id VARCHAR(255) NOT NULL,
    business_name VARCHAR(255),
    business_type VARCHAR(100),
    
    -- Contract Dates
    lease_start_date DATE NOT NULL,
    lease_end_date DATE NOT NULL,
    renewal_count INT default 0,
    parent_lease_id VARCHAR(255) null,
    
    monthly_rent DECIMAL(10,2) NOT NULL,
    lease_status ENUM('ACTIVE', 'EXPIRED', 'TERMINATED', 'PENDING'),
    
    -- Per-lease overrideable settings
    security_deposit_months INT NOT NULL, -- 1
    advance_payment_months INT NOT NULL, -- 2
    payment_frequency ENUM('Monthly','Quarterly','Yearly') NOT NULL, -- Monthly
    quarterly_tax_percentage DECIMAL(5,2) NOT NULL, -- 8% for owner, 3% for tenant
    
    lease_term_months INT NOT NULL, -- 24 months min
    late_fee_percentage DECIMAL(5,2) NOT NULL, -- 10.00
    grace_period_days INT not null, -- 10,
    is_security_deposit_refundable BOOLEAN not null, -- default TRUE, refundable after end of lease term
    
    -- Termination Rules
    auto_termination_after_months INT not null, -- 2 months of nonpayment
    advance_payment_forfeited_on_cancel BOOLEAN not null, -- default TRUE
    termination_trigger_days INT not null, -- 61 days after 2 months of nonpayment
    
    notice_before_cancel_days INT not null, -- 30 days
    notice_before_renewal_days INT not null, -- 30 days
    rent_increase_on_renewal DECIMAL (5,2) not null, -- 10.00

    notes TEXT,
    lease_contract_id int,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP(),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),

    CONSTRAINT fk_lease_users FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT fk_lease_properties FOREIGN KEY (property_id) REFERENCES properties(property_id),
    CONSTRAINT fk_lease_parent FOREIGN KEY (parent_lease_id) REFERENCES leases(lease_id),
    CONSTRAINT fk_lease_contract FOREIGN KEY (lease_contract_id) REFERENCES lease_contracts(lease_contract_id) ON DELETE CASCADE
);`;

export default leasesTable;