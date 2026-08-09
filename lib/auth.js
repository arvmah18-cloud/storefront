const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header.split(';').filter(Boolean).map((pair) => {
      const idx = pair.indexOf('=');
      return [pair.slice(0, idx).trim(), decodeURIComponent(pair.slice(idx + 1).trim())];
    })
  );
}

function createSessionCookie() {
  const token = jwt.sign({ admin: true }, process.env.SESSION_SECRET, { expiresIn: SESSION_TTL_SECONDS });
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_SECONDS}; SameSite=Lax${secure}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

function isAdminRequest(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return false;
  try {
    const payload = jwt.verify(token, process.env.SESSION_SECRET);
    return payload.admin === true;
  } catch {
    return false;
  }
}

function requireAdmin(req, res) {
  if (!isAdminRequest(req)) {
    res.status(401).json({ error: 'Not authenticated' });
    return false;
  }
  return true;
}

module.exports = { createSessionCookie, clearSessionCookie, isAdminRequest, requireAdmin };
