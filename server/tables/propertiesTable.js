const propertiesTable = `
CREATE TABLE IF NOT EXISTS properties (
    property_id VARCHAR(255) PRIMARY KEY NOT NULL,
    property_name VARCHAR(255) NOT NULL,
    floor_area_sqm DECIMAL(10,2) NOT NULL,
    description TEXT,
    display_image VARCHAR(255),
    property_status varchar(50) DEFAULT 'Available' NOT NULL,
    base_rent DECIMAL(10,2) NOT NULL,
    advance_months INT NOT NULL,
    security_deposit_months INT NOT NULL,
    minimum_lease_term_months INT DEFAULT 24 NOT NULL,
    address_id INT,
    isPosted BOOLEAN DEFAULT FALSE NOT NULL, 
    created_at timestamp DEFAULT CURRENT_TIMESTAMP(),
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
    CONSTRAINT fk_properties_address
        FOREIGN KEY (address_id) REFERENCES addresses(address_id)
        ON DELETE SET NULL
) ENGINE=InnoDB;
`;


export default propertiesTable;
