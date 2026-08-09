-- Digital storefront schema.
-- Run this once against a fresh Postgres database (Supabase SQL editor, Neon console, or psql).

create extension if not exists pgcrypto;

create table if not exists products (
  id               text primary key,
  name             text not null,
  category         text not null,
  original_price   numeric(10,2) not null,
  sale_price       numeric(10,2),
  rating           numeric(2,1) not null default 5.0,
  review_count     integer not null default 0,
  short_description text not null default '',
  includes         jsonb not null default '[]',
  image            text,
  file_key         text, -- path inside the storage bucket to the deliverable; set from the admin panel
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists orders (
  id                    uuid primary key default gen_random_uuid(),
  order_number          text unique not null,
  stripe_session_id     text unique not null,
  stripe_payment_intent text,
  customer_email        text not null,
  status                text not null default 'pending', -- pending | paid | failed
  amount_total          numeric(10,2) not null default 0,
  currency              text not null default 'usd',
  created_at            timestamptz not null default now()
);
create index if not exists idx_orders_email on orders (customer_email);

create table if not exists order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references orders(id) on delete cascade,
  product_id        text not null references products(id),
  product_name      text not null,
  unit_price        numeric(10,2) not null,
  quantity          integer not null default 1,
  download_token    text unique not null,
  token_expires_at  timestamptz not null,
  max_downloads     integer not null default 5,
  downloads_used    integer not null default 0
);
create index if not exists idx_order_items_order on order_items (order_id);
create index if not exists idx_order_items_token on order_items (download_token);

-- Singleton row: public storefront settings (admin password lives in the
-- ADMIN_PASSWORD_HASH env var, not in this table -- see README).
create table if not exists store_settings (
  id            boolean primary key default true check (id),
  store_name    text not null,
  tagline       text not null,
  support_email text not null,
  discord_link  text
);

-- ---------------------------------------------------------------
-- Seed data: your current products and settings, carried over from
-- the store.html prototype's exported data.
-- ---------------------------------------------------------------

insert into store_settings (id, store_name, tagline, support_email, discord_link) values (
  true,
  'BLAINES SUPPLY CO.',
  'Verified Supplier Access, Delivered Instantly',
  'BlainesBusiness1@gmail.com',
  'https://discord.gg/your-invite-code'
) on conflict (id) do update set
  store_name = excluded.store_name,
  tagline = excluded.tagline,
  support_email = excluded.support_email,
  discord_link = excluded.discord_link;

insert into products (id, name, category, original_price, sale_price, rating, review_count, short_description, includes, image) values
('all-supplier-bundle','All Supplier Bundle','bundle',249,12,4.9,341,
  'Every guide in our catalog, bundled into a single all-access package with lifetime updates.',
  '["Full access to every current supplier guide","All future guides added at no extra cost","Priority Discord role & support","Verified agent contact sheets"]', null),
('athletic-short-set-supplier','Athletic Short Set Supplier','apparel',39,19,4.7,158,
  'A vetted sourcing guide for athletic short sets, covering fabric grades and order minimums.',
  '["Verified supplier contact list","Size chart & fabric reference","Sample order walkthrough","Update notifications"]', null),
('streetwear-tee-supplier','Streetwear Tee Supplier','apparel',29,null,4.6,96,
  'Sourcing information for streetwear-cut t-shirts, including blank and print-ready options.',
  '["Verified supplier contact list","Fabric weight comparison sheet","Minimum order guidance","Email support"]', null),
('footwear-supplier','Footwear Supplier','footwear',59,35,4.8,264,
  'A curated sourcing guide covering footwear manufacturers and quality-control checkpoints.',
  '["Verified supplier contact list","QC checklist template","Sizing & last reference guide","Priority Discord access"]', null),
('sports-jerseys-supplier','Sports Jerseys Supplier','jerseys',45,null,4.5,87,
  'Sourcing information for athletic jerseys, including fabric and stitching specifications.',
  '["Verified supplier contact list","Fabric & stitching reference","Sample request guidance","Update notifications"]', null),
('electronics-supplier','Electronics Supplier','electronics',89,59,4.7,203,
  'A vetted list of electronics manufacturers with notes on certification and unit testing.',
  '["Verified supplier contact list","Certification reference sheet","Sample unit testing checklist","Priority Discord access"]', null),
('fragrance-supplier','Fragrance Supplier','fragrance',25,null,4.4,61,
  'Sourcing information for fragrance manufacturers, including concentration and batch guidance.',
  '["Verified supplier contact list","Concentration reference guide","Minimum batch guidance","Email support"]', null),
('knit-sweater-supplier','Knit Sweater Supplier','sweater',35,22,4.6,112,
  'A curated guide for knitwear manufacturers, covering yarn grades and finishing options.',
  '["Verified supplier contact list","Yarn grade comparison sheet","Finishing options reference","Update notifications"]', null),
('athletic-set-supplier','Athletic Set Supplier','apparel',42,null,4.5,74,
  'Sourcing information for matching athletic sets, from fabric blends to packaging options.',
  '["Verified supplier contact list","Fabric blend reference","Packaging options guide","Email support"]', null),
('premium-sweater-supplier','Premium Sweater Supplier','sweater',48,28,4.8,139,
  'An elevated knitwear sourcing guide with a focus on premium yarn and construction quality.',
  '["Verified supplier contact list","Premium yarn grade guide","Construction quality checklist","Priority Discord access"]', null)
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  original_price = excluded.original_price,
  sale_price = excluded.sale_price,
  rating = excluded.rating,
  review_count = excluded.review_count,
  short_description = excluded.short_description,
  includes = excluded.includes,
  image = excluded.image,
  updated_at = now();
