const db = require('../../lib/db');
const { requireAdmin } = require('../../lib/auth');
const { uploadToBucket, getPublicUrl } = require('../../lib/storage');

const MAX_BYTES = 4.5 * 1024 * 1024; // Vercel's serverless request body limit

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  if (req.method === 'POST') {
    const { productId, kind, filename, contentType, dataBase64 } = req.body || {};
    if (!productId || !['image', 'file'].includes(kind) || !dataBase64) {
      res.status(400).json({ error: 'Missing productId, kind, or file data' });
      return;
    }

    const buffer = Buffer.from(dataBase64, 'base64');
    if (buffer.length > MAX_BYTES) {
      res.status(413).json({
        error: 'File too large for the admin uploader (max ~4.5MB). For bigger files, upload directly in Supabase Storage and paste the Storage File Key instead.',
      });
      return;
    }

    const ext = (filename || '').split('.').pop() || 'bin';

    try {
      if (kind === 'image') {
        const bucket = process.env.SUPABASE_IMAGES_BUCKET || 'product-images';
        const key = `${productId}-${Date.now()}.${ext}`;
        await uploadToBucket(bucket, key, buffer, contentType);
        const url = getPublicUrl(bucket, key);
        await db.query('update products set image = $1, updated_at = now() where id = $2', [url, productId]);
        res.status(200).json({ image: url });
      } else {
        const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'digital-products';
        const key = `${productId}.${ext}`;
        await uploadToBucket(bucket, key, buffer, contentType);
        await db.query('update products set file_key = $1, updated_at = now() where id = $2', [key, productId]);
        res.status(200).json({ fileKey: key });
      }
    } catch (err) {
      console.error('upload error', err);
      res.status(500).json({ error: 'Upload failed' });
    }
    return;
  }

  if (req.method === 'DELETE') {
    const { productId, kind } = req.query;
    if (kind === 'image') {
      await db.query('update products set image = null where id = $1', [productId]);
    } else if (kind === 'file') {
      await db.query('update products set file_key = null where id = $1', [productId]);
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).end();
};
