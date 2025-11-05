const usersTable = `CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(255) PRIMARY KEY NOT NULL,
    first_name VARCHAR(64) NOT NULL,
    middle_name VARCHAR(64),
    last_name VARCHAR(64) NOT NULL,
    suffix VARCHAR(10),
    birthdate DATE,
    gender ENUM('Male', 'Female', 'Other'),
    avatar VARCHAR(500),
    email VARCHAR(64) NOT NULL,
    phone_number CHAR(15) NOT NULL,
    alt_phone_number CHAR(15),
    user_address_id INT,
    password_hash CHAR(60) NOT NULL,
    role VARCHAR(50) DEFAULT 'TENANT' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
    status ENUM('ACTIVE', 'INACTIVE', 'BANNED', 'ARCHIVED') DEFAULT 'ACTIVE' NOT NULL,
    FOREIGN KEY (user_address_id) REFERENCES user_addresses(user_address_id) ON DELETE SET NULL ON UPDATE CASCADE
);`;

export default usersTable;