const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

function downloadLinksHTML(items) {
  return items
    .map(
      (it) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #eee;">
          <div style="font-weight:600;">${escapeHTML(it.name)}</div>
          <a href="${escapeAttr(it.downloadUrl)}" style="color:#c9a961;">Download link</a>
          <div style="font-size:12px;color:#888;">Expires in 72 hours or after ${it.maxDownloads} downloads.</div>
        </td>
      </tr>`
    )
    .join('');
}

function escapeHTML(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
function escapeAttr(str) {
  return escapeHTML(str);
}

async function sendDownloadEmail({ to, storeName, orderNumber, items }) {
  const ordersUrl = `${process.env.SITE_URL}/orders`;
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
      <h2>${escapeHTML(storeName)}</h2>
      <p>Thanks for your order! Your download links are below.</p>
      <div style="background:#f6f6f6;border-radius:6px;padding:12px 16px;margin:16px 0;">
        <div style="font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#888;">Order Number</div>
        <div style="font-size:20px;font-weight:700;font-family:monospace;color:#111;">${escapeHTML(orderNumber)}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;">${downloadLinksHTML(items)}</table>
      <p style="font-size:13px;color:#555;margin-top:24px;line-height:1.6;">
        Save this email — if you ever need these links again, go to
        <a href="${escapeAttr(ordersUrl)}" style="color:#c9a961;">${escapeHTML(ordersUrl)}</a>
        and enter this email address plus the order number above.
      </p>
      <p style="font-size:12px;color:#888;margin-top:12px;">If a link has expired, reply to this email and we'll issue a new one.</p>
    </div>`;

  return resend.emails.send({
    from: process.env.EMAIL_FROM,
    to,
    subject: `Your ${storeName} order ${orderNumber} — download links inside`,
    html,
  });
}

module.exports = { sendDownloadEmail };
