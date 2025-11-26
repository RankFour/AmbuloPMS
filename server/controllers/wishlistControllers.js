import expressAsync from 'express-async-handler';
import jwt from 'jsonwebtoken';
import wishlistServices from '../services/wishlistServices.js';

function getUserIdFromReq(req) {
  try {
    const token = (req.cookies && req.cookies.token) || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    if (!token) return null;
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload && (payload.user_id || payload.userId || payload.id) || null;
  } catch (_) { return null; }
}

const getWishlist = expressAsync(async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const ids = await wishlistServices.getWishlistByUser(userId);
  res.json({ wishlist: ids });
});

const addWishlist = expressAsync(async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { property_id } = req.body || {};
  if (!property_id) return res.status(400).json({ message: 'property_id is required' });
  const result = await wishlistServices.addToWishlist(userId, property_id);
  res.json({ message: 'Added to wishlist', ...result });
});

const removeWishlist = expressAsync(async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const propertyId = req.params.property_id || req.body?.property_id;
  if (!propertyId) return res.status(400).json({ message: 'property_id is required' });
  const result = await wishlistServices.removeFromWishlist(userId, propertyId);
  res.json({ message: 'Removed from wishlist', property_id: propertyId, ...result });
});

export { getWishlist, addWishlist, removeWishlist };
