import cloudinary from '../middlewares/multer/cloudinaryConfig.js';

const BASE_FOLDER = 'documents';

function normalizePath(path = '') {
  const p = String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!p) return BASE_FOLDER;
  return `${BASE_FOLDER}/${p}`;
}

export const documentsService = {
  async list(path = '') {
    const folder = normalizePath(path);
    // List subfolders
    let folders = [];
    try {
      const res = await cloudinary.api.sub_folders(folder);
      folders = (res.folders || []).map((f) => ({ name: f.name, path: `${path ? path + '/' : ''}${f.name}` }));
    } catch (e) {
      // If folder doesn't exist yet, treat as empty
      folders = [];
    }

    // List resources in folder (all resource types)
    const files = [];
    try {
      const search = await cloudinary.search
        .expression(`folder="${folder}"`)
        .with_field('context')
        .max_results(200)
        .execute();
      for (const r of search.resources || []) {
        files.push({
          public_id: r.public_id,
          filename: r.filename || r.public_id.split('/').pop(),
          secure_url: r.secure_url,
          bytes: r.bytes,
          format: r.format,
          resource_type: r.resource_type,
          folder: r.folder,
          created_at: r.created_at,
        });
      }
    } catch (e) {
      // ignore
    }

    return { folders, files };
  },

  async createFolder(path = '', name) {
    const target = normalizePath(path ? `${path}/${name}` : name);
    const res = await cloudinary.api.create_folder(target);
    return { name, path: path ? `${path}/${name}` : name, raw: res };
  },

  async deleteFile(public_id, resource_type = 'image') {
    const res = await cloudinary.uploader.destroy(public_id, { resource_type });
    return res;
  },

  async deleteFolder(path = '') {
    const target = normalizePath(path);
    // Delete all resources under prefix
    await cloudinary.api.delete_resources_by_prefix(`${target}/`);
    try {
      await cloudinary.api.delete_folder(target);
    } catch (e) {
      // Ignore if already gone
    }
    return { ok: true };
  },

  async renameFile(public_id, new_public_id, resource_type = 'image') {
    const res = await cloudinary.uploader.rename(public_id, new_public_id, { resource_type });
    return res;
  },
};
