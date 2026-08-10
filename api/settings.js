const db = require('../lib/db');
const { requireAdmin } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const { rows } = await db.query('select store_name, tagline, support_email from store_settings limit 1');
    const s = rows[0] || {};
    res.status(200).json({
      storeName: s.store_name,
      tagline: s.tagline,
      supportEmail: s.support_email,
    });
    return;
  }

  if (req.method === 'PUT') {
    if (!requireAdmin(req, res)) return;
    const b = req.body || {};
    const { rows } = await db.query(
      `update store_settings set store_name=$1, tagline=$2, support_email=$3 where id = true returning *`,
      [b.storeName, b.tagline, b.supportEmail]
    );
    res.status(200).json({
      storeName: rows[0].store_name,
      tagline: rows[0].tagline,
      supportEmail: rows[0].support_email,
    });
    return;
  }

  res.status(405).end();
};
