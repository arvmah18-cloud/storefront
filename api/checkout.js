const db = require('../lib/db');
const stripe = require('../lib/stripe');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { items, email } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Cart is empty' });
      return;
    }

    const ids = items.map((i) => String(i.id));
    const { rows: products } = await db.query(
      'select id, name, original_price, sale_price, file_key from products where id = any($1)',
      [ids]
    );

    const missingFile = products.find((p) => !p.file_key);
    if (missingFile) {
      res.status(400).json({ error: `"${missingFile.name}" isn't available for purchase yet — no file has been uploaded for it.` });
      return;
    }

    const cartMeta = [];
    const line_items = items.map((item) => {
      const product = products.find((p) => p.id === item.id);
      if (!product) throw new Error(`Unknown product: ${item.id}`);
      const qty = Math.max(1, parseInt(item.qty, 10) || 1);
      const price = product.sale_price != null ? Number(product.sale_price) : Number(product.original_price);
      cartMeta.push({ id: product.id, qty });
      return {
        price_data: {
          currency: 'usd',
          product_data: { name: product.name },
          unit_amount: Math.round(price * 100),
        },
        quantity: qty,
      };
    });

    const siteUrl = process.env.SITE_URL;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      customer_email: email || undefined,
      success_url: `${siteUrl}/#/confirmation/{CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/#/cart`,
      metadata: { cart: JSON.stringify(cartMeta) },
      // This account has Stripe Managed Payments on by default, which requires a
      // tax code on every product unless disabled — irrelevant for digital goods
      // priced ad-hoc via price_data, so it's turned off for this session.
      managed_payments: { enabled: false },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('checkout error', err);
    res.status(500).json({ error: 'Unable to start checkout' });
  }
};
