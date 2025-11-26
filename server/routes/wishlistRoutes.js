import express from 'express';
import { getWishlist, addWishlist, removeWishlist } from '../controllers/wishlistControllers.js';

const router = express.Router();

router.get('/', getWishlist);
router.post('/', addWishlist);
router.delete('/:property_id', removeWishlist);

export default router;
