# Storefront

Digital-goods storefront. Static frontend (`store.html`) + Vercel serverless
API (`/api`) backed by Postgres, Stripe Checkout, Resend, and Supabase
Storage for the actual product files.

## Architecture

- `store.html` — the storefront UI (catalog, cart, checkout, admin panel).
  Talks to the API below over `fetch`; no secrets or business logic live
  client-side.
- `api/checkout.js` — creates a Stripe Checkout Session for the cart and
  returns its URL. The browser is redirected to Stripe's hosted payment
  page; card details never touch this server.
- `api/webhook.js` — Stripe webhook. On `checkout.session.completed`,
  records the order, generates a time-limited download token per item, and
  emails the customer their links. This is the only place an order is
  ever marked "paid" — never trust the client or the success-page redirect
  alone.
- `api/download.js` — validates a download token (not expired, under its
  download cap, order is paid) and redirects to a short-lived signed URL
  from Supabase Storage.
- `api/order.js` — used by the confirmation page to poll for the order
  shortly after Stripe redirects back (the webhook can land a second or
  two later).
- `api/products.js`, `api/settings.js` — public read endpoints for the
  storefront.
- `api/admin/*` — cookie-authenticated admin endpoints (login, product
  CRUD, order list + resend, settings).
- `lib/` — shared helpers: Postgres pool, Stripe client, Resend email,
  Supabase Storage signed URLs, admin session (JWT in an httpOnly cookie).
- `schema.sql` — run once against your database. Seeds it with your
  current product catalog and store settings.

## Known gap before this is truly live

`schema.sql` seeds every product with `file_key = NULL`. **No product has
an actual deliverable file attached yet.** Until you upload files to
Supabase Storage and set each product's "Storage File Key" in the admin
panel, `/api/download` will return "not available yet" for every
purchase. This is the next thing to do after deployment.

## Environment variables

See `.env.example`. Set these in Vercel's project settings (Settings →
Environment Variables), not in a committed file.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (Supabase or Neon) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the `/api/webhook` endpoint |
| `RESEND_API_KEY` | Resend API key |
| `EMAIL_FROM` | Verified sender, e.g. `"Blaines Supply Co. <orders@yourdomain.com>"` |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side only — never expose client-side) |
| `SUPABASE_STORAGE_BUCKET` | Private bucket name holding the deliverable files |
| `ADMIN_PASSWORD` | The password typed on the `/#/admin` login screen |
| `SESSION_SECRET` | Random string used to sign the admin session cookie |
| `SITE_URL` | Your deployed site's URL, no trailing slash |

To change the admin password later: update `ADMIN_PASSWORD` in Vercel,
then redeploy. It is intentionally not stored in the database or editable
from the admin UI, so a database compromise alone can't expose it.

## Local development

```bash
npm install
vercel dev
```

`vercel dev` runs both the static file and the `/api` serverless
functions together, which a plain static server won't. Copy
`.env.example` to `.env` and fill it in first.

## Deploy order

1. Create the Postgres database and run `schema.sql` against it.
2. Create the Stripe account, get API keys, add the webhook pointing at
   `<SITE_URL>/api/webhook` for the `checkout.session.completed` event.
3. Create the Resend account and verify a sending domain.
4. Create the Supabase Storage bucket (private) and upload the product
   files.
5. Deploy to Vercel, set all environment variables above, connect your
   domain.
6. In the admin panel, set each product's Storage File Key to match what
   you uploaded in step 4.

Deployed via Vercel.
