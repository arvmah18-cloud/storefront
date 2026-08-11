const crypto = require('crypto');
const db = require('../../lib/db');
const { requireAdmin } = require('../../lib/auth');
const { sendDownloadEmail } = require('../../lib/email');

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    const { rows: orders } = await db.query('select * from orders order by created_at desc');
    const { rows: items } = await db.query('select * from order_items');
    const withItems = orders.map((o) => ({
      ...o,
      items: items.filter((i) => i.order_id === o.id),
    }));
    res.status(200).json({ orders: withItems });
    return;
  }

  if (req.method === 'POST') {
    const { action, orderId, itemId } = req.body || {};

    if (action === 'reissue') {
      const newToken = crypto.randomBytes(20).toString('hex');
      const newExpiry = new Date(Date.now() + 1000 * 60 * 60 * 72);
      const { rows } = await db.query(
        'update order_items set download_token = $1, token_expires_at = $2, downloads_used = 0 where id = $3 returning download_token',
        [newToken, newExpiry, itemId]
      );
      if (rows.length === 0) {
        res.status(404).json({ error: 'Order item not found' });
        return;
      }
      res.status(200).json({ downloadToken: rows[0].download_token });
      return;
    }

    if (action !== 'resend') {
      res.status(400).json({ error: 'Unknown action' });
      return;
    }
    const { rows: orderRows } = await db.query('select * from orders where id = $1', [orderId]);
    const order = orderRows[0];
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    const newExpiry = new Date(Date.now() + 1000 * 60 * 60 * 72);
    const { rows: items } = await db.query(
      'update order_items set token_expires_at = $1 where order_id = $2 returning product_name as name, download_token, max_downloads',
      [newExpiry, orderId]
    );
    const { rows: settingsRows } = await db.query('select store_name from store_settings limit 1');
    const storeName = settingsRows[0]?.store_name || 'Store';
    await sendDownloadEmail({
      to: order.customer_email,
      storeName,
      orderNumber: order.order_number,
      items: items.map((it) => ({
        name: it.name,
        downloadUrl: `${process.env.SITE_URL}/download/${it.download_token}`,
        maxDownloads: it.max_downloads,
      })),
    });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).end();
};
