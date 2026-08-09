const db = require('../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }
  const { rows } = await db.query('select store_name, tagline, support_email, discord_link from store_settings limit 1');
  const s = rows[0] || {};
  res.status(200).json({
    storeName: s.store_name,
    tagline: s.tagline,
    supportEmail: s.support_email,
    discordLink: s.discord_link,
  });
};
