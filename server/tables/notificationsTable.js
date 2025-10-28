const notificationsTable = `
CREATE TABLE IF NOT EXISTS notifications (
  notification_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(32) DEFAULT 'INFO',
  title VARCHAR(255) NOT NULL,
  body TEXT,
  link VARCHAR(512),
  meta TEXT,
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_user (user_id),
  INDEX idx_notifications_read (is_read),
  INDEX idx_notifications_created (created_at),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
`;

export default notificationsTable;
