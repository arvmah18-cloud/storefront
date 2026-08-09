const crypto = require('crypto');
const { createSessionCookie, clearSessionCookie, isAdminRequest } = require('../../lib/auth');

function passwordMatches(input) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!input || !expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false; // timingSafeEqual requires equal length
  return crypto.timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).json({ authed: isAdminRequest(req) });
    return;
  }

  if (req.method === 'POST') {
    const { password } = req.body || {};
    if (!passwordMatches(password)) {
      res.status(401).json({ error: 'Incorrect password' });
      return;
    }
    res.setHeader('Set-Cookie', createSessionCookie());
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearSessionCookie());
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).end();
};
