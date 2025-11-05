const contactSubmissionsTable = `CREATE TABLE IF NOT EXISTS contact_submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    phone_number VARCHAR(20),
    subject VARCHAR(150),
    business_type VARCHAR(100),
    preferred_space_size VARCHAR(50),
    monthly_budget_range VARCHAR(50),
    message TEXT NOT NULL,
    status varchar(20) DEFAULT 'pending',
    replied_at DATETIME null,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);`;

export default contactSubmissionsTable;