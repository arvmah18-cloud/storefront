const db = require('../../lib/db');
const { requireAdmin } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  if (req.method === 'PUT') {
    const b = req.body || {};
    const { rows } = await db.query(
      `update store_settings set store_name=$1, tagline=$2, support_email=$3, discord_link=$4 where id = true returning *`,
      [b.storeName, b.tagline, b.supportEmail, b.discordLink]
    );
    res.status(200).json({
      storeName: rows[0].store_name,
      tagline: rows[0].tagline,
      supportEmail: rows[0].support_email,
      discordLink: rows[0].discord_link,
    });
    return;
  }

  res.status(405).end();
};
