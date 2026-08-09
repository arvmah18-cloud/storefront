const db = require('../lib/db');
const { createSignedDownloadUrl } = require('../lib/storage');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const token = req.query.token;
  if (!token) {
    res.status(400).send('Missing token');
    return;
  }

  const { rows } = await db.query(
    `select oi.id, oi.product_id, oi.token_expires_at, oi.max_downloads, oi.downloads_used, o.status, p.file_key, p.name
     from order_items oi
     join orders o on o.id = oi.order_id
     join products p on p.id = oi.product_id
     where oi.download_token = $1`,
    [token]
  );

  const item = rows[0];
  if (!item || item.status !== 'paid') {
    res.status(404).send('Download link not found.');
    return;
  }
  if (new Date(item.token_expires_at) < new Date()) {
    res.status(410).send('This download link has expired. Contact support for a new one.');
    return;
  }
  if (item.downloads_used >= item.max_downloads) {
    res.status(410).send('This download link has reached its download limit. Contact support for a new one.');
    return;
  }
  if (!item.file_key) {
    res.status(503).send('This file is not available yet. Contact support.');
    return;
  }

  const signedUrl = await createSignedDownloadUrl(item.file_key, 60);
  await db.query('update order_items set downloads_used = downloads_used + 1 where id = $1', [item.id]);

  res.writeHead(302, { Location: signedUrl });
  res.end();
};
