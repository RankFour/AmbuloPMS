import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import {
  createTicket,
  updateTicketStatuses,
  getTickets,
  getSingleTicketById,
  getTicketsByUserId,
  updateTicketById,
  deleteTicket,
} from "../controllers/ticketsControllers.js";

import createUploadMiddleware from '../middlewares/multer/uploadMiddleware.js';

const router = express.Router();


router.post(
    '/create-ticket',
    createUploadMiddleware({
    fields: [
      { name: 'attachments', maxCount: 5 },
    ],
    fieldFolders: {
      attachments: 'ticket_attachments',
    },
  }), protect,
    createTicket
);

router.post('/update-ticket-statuses', protect, updateTicketStatuses);

router.get('/', protect, getTickets);
router.get('/:ticket_id', protect, getSingleTicketById);
router.get('/users/:user_id', protect, getTicketsByUserId);
router.patch('/:ticket_id', createUploadMiddleware({
    fields: [
      { name: 'attachments', maxCount: 5 },
    ],
    fieldFolders: {
      attachments: 'ticket_attachments',
    },
  }),
    protect,
    updateTicketById);

router.delete('/:ticket_id', protect, deleteTicket);

export default router;