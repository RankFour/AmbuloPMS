import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from './cloudinaryConfig.js';
import { v4 as uuidv4 } from 'uuid';

const createUploadMiddleware = ({ fields = [], fieldFolders = {} }) => {
  const allowedFormats = [
    'jpg', 'jpeg', 'png', 'svg', 'svg+xml', 'heic',
    'pdf', 'doc', 'docx', 'txt',
    'ppt', 'pptx',
    'xls', 'xlsx',
    'mp4', 'mov', 'avi',
  ];

  const mimeToExtension = {
    'jpeg': 'jpeg',
    'jpg': 'jpg',
    'png': 'png',
    'svg': 'svg',
    'svg+xml': 'svg',
    'heic': 'heic',
    'pdf': 'pdf',
    'plain': 'txt',
    'msword': 'doc',
    'vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'vnd.ms-powerpoint': 'ppt',
    'vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'vnd.ms-excel': 'xls',
    'vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'mp4': 'mp4',
    'quicktime': 'mov',
    'x-msvideo': 'avi',
  };

  const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
      const mimePart = file.mimetype.split('/')[1];
      const ext = mimeToExtension[mimePart] || mimePart;

  const isRawFile = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'].includes(ext);
      const isVideoFile = ['mp4', 'mov', 'avi'].includes(ext);

      // Allow dynamic folder resolution per request: if fieldFolders[fieldname] is a function,
      // call it with (req, file); otherwise, use the static folder string. Fallback to 'uploads'.
      let folder = 'uploads';
      const configured = fieldFolders[file.fieldname];
      try {
        if (typeof configured === 'function') {
          const val = configured(req, file);
          if (typeof val === 'string' && val.trim()) folder = val.trim();
        } else if (typeof configured === 'string' && configured.trim()) {
          folder = configured.trim();
        }
      } catch {}

      // Derive a clean public_id from the original filename (without extension)
      const originalBase = (file.originalname || 'file')
        .replace(/\\/g, '/')
        .split('/')
        .pop()
        .replace(/\.[^.]+$/, '')
        .replace(/[^A-Za-z0-9 _.-]/g, '')
        .trim() || uuidv4();

      return {
        folder,
        public_id: originalBase, // keep original filename (base) as public_id
        use_filename: true,
        unique_filename: false, // do not append random suffix; preserves original filename exactly
        overwrite: false, // avoid overwriting existing files with same name
        format: ext,
        resource_type: isRawFile ? 'raw' : isVideoFile ? 'video' : 'image',
      };
    },
  });

  const fileFilter = (req, file, cb) => {
    const fileExtension = file.mimetype.split('/')[1]?.toLowerCase();
    const normalizedExtension = mimeToExtension[fileExtension] || fileExtension;

    if (allowedFormats.includes(normalizedExtension)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported file format: ${fileExtension}. Allowed formats: ${allowedFormats.join(', ')}`
        ),
        false
      );
    }
  };

  const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

  return (req, res, next) => {
    const handler = upload.fields(fields);
    handler(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  };
};

export default createUploadMiddleware;