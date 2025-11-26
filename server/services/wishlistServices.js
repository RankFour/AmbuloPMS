import conn from "./../config/db.js";

const poolPromise = conn();

async function ensureWishlistTable() {
  const pool = await poolPromise;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wishlist (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      property_id VARCHAR(64) NOT NULL,
      created_at DATETIME DEFAULT NOW(),
      UNIQUE KEY uniq_user_property (user_id, property_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function getWishlistByUser(userId) {
  const pool = await poolPromise;
  await ensureWishlistTable();
  const [rows] = await pool.query(
    `SELECT property_id FROM wishlist WHERE user_id = ? ORDER BY created_at DESC`,
    [String(userId)]
  );
  return rows.map(r => String(r.property_id));
}

async function addToWishlist(userId, propertyId) {
  const pool = await poolPromise;
  await ensureWishlistTable();
  await pool.query(
    `INSERT IGNORE INTO wishlist (user_id, property_id, created_at) VALUES (?, ?, NOW())`,
    [String(userId), String(propertyId)]
  );
  return { user_id: String(userId), property_id: String(propertyId) };
}

async function removeFromWishlist(userId, propertyId) {
  const pool = await poolPromise;
  await ensureWishlistTable();
  const [res] = await pool.query(
    `DELETE FROM wishlist WHERE user_id = ? AND property_id = ?`,
    [String(userId), String(propertyId)]
  );
  return { removed: res.affectedRows > 0 };
}

export default {
  getWishlistByUser,
  addToWishlist,
  removeFromWishlist,
};
