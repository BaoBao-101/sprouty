import path from 'path';
import { promises as fs } from 'fs';

function uploadRoot() {
  return path.resolve(process.cwd(), process.env.LOCAL_UPLOAD_DIR || 'uploads');
}

function assertInsideRoot(root, target) {
  const rel = path.relative(root, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Invalid upload key');
}

export function localStorageProvider() {
  return {
    provider: 'local',

    async putObject({ buffer, key }) {
      const root = uploadRoot();
      const normalized = key.replace(/^\/+/, '');
      const target = path.join(root, normalized);
      assertInsideRoot(root, target);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, buffer);
      return { key: normalized, url: this.getPublicUrl({ key: normalized }) };
    },

    async deleteObject({ key }) {
      const root = uploadRoot();
      const target = path.join(root, key.replace(/^\/+/, ''));
      assertInsideRoot(root, target);
      await fs.unlink(target).catch(() => {});
    },

    getPublicUrl({ key }) {
      const base = process.env.PUBLIC_ASSET_BASE_URL || '/uploads';
      return `${base.replace(/\/$/, '')}/${key.replace(/^\/+/, '')}`;
    },

    async getSignedUrl({ key }) {
      return this.getPublicUrl({ key });
    },
  };
}

export function localUploadRoot() {
  return uploadRoot();
}
