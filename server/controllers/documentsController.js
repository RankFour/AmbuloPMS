import { documentsService } from '../services/documentsService.js';

export const documentsController = {
  async list(req, res) {
    try {
      const path = req.query.path || '';
      const data = await documentsService.list(path);
      res.json(data);
    } catch (e) {
      res.status(500).json({ message: 'Failed to fetch documents', error: String(e.message || e) });
    }
  },

  async createFolder(req, res) {
    try {
      const { path = '', name } = req.body || {};
      if (!name || typeof name !== 'string') return res.status(400).json({ message: 'Name is required' });
      const data = await documentsService.createFolder(path, name);
      res.json({ message: 'Folder created', data });
    } catch (e) {
      res.status(500).json({ message: 'Failed to create folder', error: String(e.message || e) });
    }
  },

  async deleteFile(req, res) {
    try {
      const { public_id, resource_type } = req.body || {};
      if (!public_id) return res.status(400).json({ message: 'public_id is required' });
      const result = await documentsService.deleteFile(public_id, resource_type || 'image');
      res.json({ message: 'File deleted', result });
    } catch (e) {
      res.status(500).json({ message: 'Failed to delete file', error: String(e.message || e) });
    }
  },

  async deleteFolder(req, res) {
    try {
      const { path = '' } = req.body || req.query || {};
      if (typeof path !== 'string') return res.status(400).json({ message: 'path is required' });
      const result = await documentsService.deleteFolder(path);
      res.json({ message: 'Folder deleted', result });
    } catch (e) {
      res.status(500).json({ message: 'Failed to delete folder', error: String(e.message || e) });
    }
  },

  async renameFile(req, res) {
    try {
      const { public_id, new_public_id, resource_type } = req.body || {};
      if (!public_id || !new_public_id) return res.status(400).json({ message: 'public_id and new_public_id are required' });
      const result = await documentsService.renameFile(public_id, new_public_id, resource_type || 'image');
      res.json({ message: 'Renamed', result });
    } catch (e) {
      res.status(500).json({ message: 'Failed to rename file', error: String(e.message || e) });
    }
  },

  async uploadDone(req, res) {
    try {
      // Multer + Cloudinary payloads are now on req.files
      const files = (req.files?.files || []).map((f) => ({
        originalname: f.originalname,
        filename: f.filename,
        public_id: f.filename || f.public_id, // cloudinary-storage sets `filename` as public_id
        secure_url: f.path || f.secure_url,
        bytes: f.size,
        format: f.format,
        resource_type: f.resource_type,
        folder: f.folder,
      }));
      res.json({ message: 'Uploaded', files });
    } catch (e) {
      res.status(500).json({ message: 'Upload failed', error: String(e.message || e) });
    }
  },
};
