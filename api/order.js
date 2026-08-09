const db = require('../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const sessionId = req.query.session_id;
  if (!sessionId) {
    res.status(400).json({ error: 'Missing session_id' });
    return;
  }

  const { rows: orderRows } = await db.query(
    'select id, order_number, customer_email, status from orders where stripe_session_id = $1',
    [sessionId]
  );
  const order = orderRows[0];
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  const { rows: items } = await db.query(
    'select product_name as name, download_token, token_expires_at, max_downloads, downloads_used from order_items where order_id = $1',
    [order.id]
  );

  res.status(200).json({
    orderNumber: order.order_number,
    email: order.customer_email,
    status: order.status,
    items: items.map((it) => ({
      name: it.name,
      downloadToken: it.download_token,
      expiresAt: it.token_expires_at,
      maxDownloads: it.max_downloads,
      downloadsUsed: it.downloads_used,
    })),
  });
};
