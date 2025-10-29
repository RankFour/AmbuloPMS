const assistantMessagesTable = `
CREATE TABLE IF NOT EXISTS assistant_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(64) NOT NULL,
  direction ENUM('incoming','outgoing') NOT NULL,
  text TEXT NOT NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_assistant_messages_conv (conversation_id),
  CONSTRAINT fk_assistant_messages_conv FOREIGN KEY (conversation_id)
    REFERENCES assistant_conversations (conversation_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

export default assistantMessagesTable;
