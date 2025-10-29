import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { 
  createContactUsEntry,
    getAllContactUsEntries,
    getContactUsEntryById,
    editContactUsEntry,
    deleteContactUsEntry,
    sendContactReply,
    previewContactReply
 } from '../controllers/contactUsControllers.js';

const router = express.Router();

router.post('/create-contact', createContactUsEntry);
router.get('/', protect, getAllContactUsEntries);
router.get('/:entry_id', protect, getContactUsEntryById);
router.patch('/:entry_id', protect, editContactUsEntry);
router.delete('/:entry_id', protect, deleteContactUsEntry);
router.post('/:entry_id/reply', protect, sendContactReply);
router.get('/:entry_id/reply-preview', protect, previewContactReply);
router.post('/:entry_id/reply-preview', protect, previewContactReply);

export default router;