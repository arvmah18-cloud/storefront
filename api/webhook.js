const crypto = require('crypto');
const db = require('../lib/db');
const stripe = require('../lib/stripe');
const { readRawBody } = require('../lib/raw-body');
const { sendDownloadEmail } = require('../lib/email');

const TOKEN_TTL_MS = 1000 * 60 * 60 * 72; // 72 hours
const MAX_DOWNLOADS = 5;

function genOrderNumber() {
  return 'ORD-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}
function genDownloadToken() {
  return crypto.randomBytes(20).toString('hex');
}

async function fulfillOrder(session) {
  const existing = await db.query('select id from orders where stripe_session_id = $1', [session.id]);
  if (existing.rows.length > 0) return; // already processed (webhook retries)

  const cart = JSON.parse(session.metadata?.cart || '[]');
  const ids = cart.map((c) => c.id);
  const { rows: products } = await db.query('select * from products where id = any($1)', [ids]);

  const orderNumber = genOrderNumber();
  const client = await db.getPool().connect();
  const items = [];
  try {
    await client.query('begin');
    const orderRes = await client.query(
      `insert into orders (order_number, stripe_session_id, stripe_payment_intent, customer_email, status, amount_total, currency)
       values ($1,$2,$3,$4,'paid',$5,$6) returning id`,
      [
        orderNumber,
        session.id,
        session.payment_intent,
        session.customer_details?.email || session.customer_email,
        (session.amount_total || 0) / 100,
        session.currency || 'usd',
      ]
    );
    const orderId = orderRes.rows[0].id;

    for (const line of cart) {
      const product = products.find((p) => p.id === line.id);
      if (!product) continue;
      const token = genDownloadToken();
      const price = product.sale_price != null ? Number(product.sale_price) : Number(product.original_price);
      await client.query(
        `insert into order_items (order_id, product_id, product_name, unit_price, quantity, download_token, token_expires_at, max_downloads)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [orderId, product.id, product.name, price, line.qty, token, new Date(Date.now() + TOKEN_TTL_MS), MAX_DOWNLOADS]
      );
      items.push({ name: product.name, downloadUrl: `${process.env.SITE_URL}/#/download/${token}`, maxDownloads: MAX_DOWNLOADS });
    }

    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }

  const to = session.customer_details?.email || session.customer_email;
  if (to && items.length > 0) {
    const { rows: settingsRows } = await db.query('select store_name from store_settings limit 1');
    const storeName = settingsRows[0]?.store_name || 'Store';
    await sendDownloadEmail({ to, storeName, orderNumber, items });
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('webhook signature verification failed', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const full = await stripe.checkout.sessions.retrieve(session.id, { expand: ['customer_details'] });
      await fulfillOrder(full);
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('webhook handling error', err);
    res.status(500).json({ error: 'Webhook handling failed' });
  }
};

module.exports.config = { api: { bodyParser: false } };
