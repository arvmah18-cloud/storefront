const db = require('../lib/db');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHTML(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const { name, email, subject, orderNumber, message } = req.body || {};
  if (!name || !email || !subject || !message) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const { rows } = await db.query('select store_name, support_email from store_settings limit 1');
  const settings = rows[0] || {};

  const html = `
    <div style="font-family:sans-serif;max-width:520px;">
      <p><strong>From:</strong> ${escapeHTML(name)} (${escapeHTML(email)})</p>
      <p><strong>Subject:</strong> ${escapeHTML(subject)}</p>
      ${orderNumber ? `<p><strong>Order:</strong> ${escapeHTML(orderNumber)}</p>` : ''}
      <p><strong>Message:</strong></p>
      <p>${escapeHTML(message).replace(/\n/g, '<br>')}</p>
    </div>`;

  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: settings.support_email,
    replyTo: email,
    subject: `[${settings.store_name || 'Store'} contact] ${subject}`,
    html,
  });

  res.status(200).json({ ok: true });
};
