const leaseRenewalsTable = `CREATE TABLE IF NOT EXISTS lease_renewals (
  renewal_id INT AUTO_INCREMENT PRIMARY KEY,
  lease_id VARCHAR(255) NOT NULL,
  previous_end_date DATE NOT NULL,
  new_end_date DATE NOT NULL,
  previous_rent DECIMAL(12,2) NOT NULL,
  new_rent DECIMAL(12,2) NOT NULL,
  rent_increase_pct DECIMAL(7,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  FOREIGN KEY (lease_id) REFERENCES leases(lease_id)
) ENGINE=InnoDB;`;

export default leaseRenewalsTable;