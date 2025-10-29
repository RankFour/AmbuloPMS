const assistantConversationsTable = `
CREATE TABLE IF NOT EXISTS assistant_conversations (
  conversation_id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_assistant_conversations_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

export default assistantConversationsTable;
