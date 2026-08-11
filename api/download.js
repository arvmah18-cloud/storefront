const db = require('../lib/db');
const { createSignedDownloadUrl } = require('../lib/storage');

async function lookup(token) {
  const { rows } = await db.query(
    `select oi.id, oi.token_expires_at, oi.max_downloads, oi.downloads_used, o.status, p.file_key, p.name
     from order_items oi
     join orders o on o.id = oi.order_id
     join products p on p.id = oi.product_id
     where oi.download_token = $1`,
    [token]
  );
  return rows[0];
}

// Read-only status check, used by the #/download/:token landing page before
// the real download link is clicked — so an email client's link-preview bot
// can't silently burn through the download cap.
async function handleStatus(req, res, token) {
  const item = await lookup(token);
  if (!item || item.status !== 'paid') {
    res.status(404).json({ valid: false, reason: 'not_found' });
    return;
  }
  if (new Date(item.token_expires_at) < new Date()) {
    res.status(200).json({ valid: false, reason: 'expired', name: item.name });
    return;
  }
  if (item.downloads_used >= item.max_downloads) {
    res.status(200).json({ valid: false, reason: 'exhausted', name: item.name });
    return;
  }
  res.status(200).json({
    valid: true,
    name: item.name,
    expiresAt: item.token_expires_at,
    maxDownloads: item.max_downloads,
    downloadsUsed: item.downloads_used,
  });
}

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

  if (req.query.status) {
    await handleStatus(req, res, token);
    return;
  }

  const item = await lookup(token);
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

  let signedUrl;
  try {
    signedUrl = await createSignedDownloadUrl(item.file_key, 60);
  } catch (err) {
    // Most common cause: the product's Storage File Key doesn't match any
    // file actually uploaded (e.g. typed in manually instead of uploaded).
    // Fail cleanly instead of crashing, and don't burn the customer's
    // download count on a link that never delivered anything.
    console.error(`download failed for token ${token}, file_key "${item.file_key}":`, err.message || err);
    res.status(503).send('This file could not be retrieved right now. Contact support and we\'ll sort it out — your download count has not been used.');
    return;
  }

  await db.query('update order_items set downloads_used = downloads_used + 1 where id = $1', [item.id]);

  res.writeHead(302, { Location: signedUrl });
  res.end();
};
