import express from 'express';
import { documentsController } from '../controllers/documentsController.js';
import createUploadMiddleware from '../middlewares/multer/uploadMiddleware.js';

const router = express.Router();

// Dynamic folder resolution based on request body.path
const upload = createUploadMiddleware({
  fields: [{ name: 'files', maxCount: 20 }],
  fieldFolders: {
    files: (req) => {
      const raw = (req.body?.path || '').toString().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      return raw ? `documents/${raw}` : 'documents';
    },
  },
});

router.get('/', documentsController.list);
router.post('/folder', express.json(), documentsController.createFolder);
router.delete('/file', express.json(), documentsController.deleteFile);
router.delete('/folder', express.json(), documentsController.deleteFolder);
router.post('/rename', express.json(), documentsController.renameFile);
router.post('/upload', upload, documentsController.uploadDone);

export default router;
