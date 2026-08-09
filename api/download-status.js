const db = require('../lib/db');

// Read-only lookup: reports whether a download link is still good, without
// consuming a download or touching storage. The landing page at
// #/download/:token calls this first so an email client's link-preview bot
// can't silently burn through the download cap before a customer clicks.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const token = req.query.token;
  if (!token) {
    res.status(400).json({ error: 'Missing token' });
    return;
  }

  const { rows } = await db.query(
    `select oi.token_expires_at, oi.max_downloads, oi.downloads_used, o.status, p.name
     from order_items oi
     join orders o on o.id = oi.order_id
     join products p on p.id = oi.product_id
     where oi.download_token = $1`,
    [token]
  );

  const item = rows[0];
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
};
