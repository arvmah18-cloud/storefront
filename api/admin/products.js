const db = require('../../lib/db');
const { requireAdmin } = require('../../lib/auth');

function slugify(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') +
    '-' +
    Math.random().toString(36).slice(2, 6)
  );
}

function toClient(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    originalPrice: Number(row.original_price),
    salePrice: row.sale_price != null ? Number(row.sale_price) : null,
    rating: Number(row.rating),
    reviewCount: row.review_count,
    short: row.short_description,
    includes: row.includes,
    image: row.image,
    fileKey: row.file_key,
  };
}

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    const { rows } = await db.query(`select * from products order by (id = 'all-supplier-bundle') desc, created_at asc`);
    res.status(200).json({ products: rows.map(toClient) });
    return;
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    const id = slugify(b.name || 'product');
    const { rows } = await db.query(
      `insert into products (id, name, category, original_price, sale_price, rating, review_count, short_description, includes, image, file_key)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
      [id, b.name, b.category, b.originalPrice, b.salePrice ?? null, b.rating ?? 4.8, b.reviewCount ?? 0, b.short ?? '', JSON.stringify(b.includes || []), b.image ?? null, b.fileKey ?? null]
    );
    res.status(201).json({ product: toClient(rows[0]) });
    return;
  }

  if (req.method === 'PUT') {
    const id = req.query.id;
    const b = req.body || {};
    const { rows } = await db.query(
      `update products set name=$1, category=$2, original_price=$3, sale_price=$4, short_description=$5, includes=$6, image=$7, file_key=$8, updated_at=now()
       where id=$9 returning *`,
      [b.name, b.category, b.originalPrice, b.salePrice ?? null, b.short ?? '', JSON.stringify(b.includes || []), b.image ?? null, b.fileKey ?? null, id]
    );
    if (rows.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.status(200).json({ product: toClient(rows[0]) });
    return;
  }

  if (req.method === 'DELETE') {
    const id = req.query.id;
    await db.query('delete from products where id = $1', [id]);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).end();
};
