const db = require('../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }
  const { rows } = await db.query(
    `select id, name, category, original_price, sale_price, rating, review_count, short_description, includes, image
     from products order by created_at asc`
  );
  res.status(200).json({
    products: rows.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      originalPrice: Number(p.original_price),
      salePrice: p.sale_price != null ? Number(p.sale_price) : null,
      rating: Number(p.rating),
      reviewCount: p.review_count,
      short: p.short_description,
      includes: p.includes,
      image: p.image,
    })),
  });
};
