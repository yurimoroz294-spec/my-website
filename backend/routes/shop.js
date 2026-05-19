const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const { parse } = require('csv-parse/sync');
const auth    = require('../middleware/auth');
const db      = require('../db');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/shop
router.get('/', auth, (req, res) => {
  const { password_hash, ...shop } = req.shop;
  const config       = JSON.parse(shop.config || '{}');
  const product_count = db.prepare('SELECT COUNT(*) as c FROM products WHERE shop_id = ?').get(shop.id).c;
  const faq_count    = db.prepare('SELECT COUNT(*) as c FROM faqs    WHERE shop_id = ?').get(shop.id).c;
  res.json({ ...shop, config, product_count, faq_count });
});

// PATCH /api/shop/config
router.patch('/config', auth, (req, res) => {
  const { tone, complaint_url, name, website_url, operator_prompt } = req.body;
  const cfg = { ...JSON.parse(req.shop.config || '{}') };
  if (tone            !== undefined) cfg.tone             = tone;
  if (complaint_url   !== undefined) cfg.complaint_url    = complaint_url;
  if (operator_prompt !== undefined) cfg.operator_prompt  = operator_prompt;

  db.prepare('UPDATE shops SET config = ?, name = COALESCE(?, name), website_url = COALESCE(?, website_url) WHERE id = ?')
    .run(JSON.stringify(cfg), name || null, website_url || null, req.shop.id);

  res.json({ config: cfg });
});

// POST /api/shop/catalog  (CSV upload)
router.post('/catalog', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'CSV file required' });

  let records;
  try {
    records = parse(req.file.buffer.toString('utf8'), { columns: true, skip_empty_lines: true, trim: true });
  } catch (err) {
    return res.status(400).json({ error: 'invalid CSV: ' + err.message });
  }
  if (!records.length) return res.status(400).json({ error: 'CSV is empty' });

  const norm = r => ({
    name:        r.name || r.Name || r.nazev || r.Název || r.title || r.Title || '',
    price:       parseFloat(r.price || r.Price || r.cena || r.Cena || 0) || null,
    description: r.description || r.Description || r.popis || r.Popis || '',
    category:    r.category    || r.Category    || r.kategorie || r.Kategorie || '',
    url:         r.url         || r.URL          || r.link      || r.Link || '',
    in_stock:    ['0','false','ne','no'].includes(String(r.in_stock || r.skladem || '').toLowerCase()) ? 0 : 1,
  });

  const del = db.prepare('DELETE FROM products WHERE shop_id = ?');
  const ins = db.prepare('INSERT INTO products (shop_id, name, price, description, category, url, in_stock) VALUES (?,?,?,?,?,?,?)');

  const run = db.transaction((id, rows) => {
    del.run(id);
    let n = 0;
    for (const r of rows) {
      const p = norm(r);
      if (!p.name) continue;
      ins.run(id, p.name, p.price, p.description, p.category, p.url, p.in_stock);
      n++;
    }
    return n;
  });

  res.json({ imported: run(req.shop.id, records), total_in_file: records.length });
});

// GET /api/shop/products
router.get('/products', auth, (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = (Math.max(parseInt(req.query.page) || 1, 1) - 1) * limit;
  const total  = db.prepare('SELECT COUNT(*) as c FROM products WHERE shop_id = ?').get(req.shop.id).c;
  const items  = db.prepare('SELECT * FROM products WHERE shop_id = ? LIMIT ? OFFSET ?').all(req.shop.id, limit, offset);
  res.json({ products: items, total });
});

// DELETE /api/shop/products
router.delete('/products', auth, (req, res) => {
  const { changes } = db.prepare('DELETE FROM products WHERE shop_id = ?').run(req.shop.id);
  res.json({ deleted: changes });
});

// POST /api/shop/faqs
router.post('/faqs', auth, (req, res) => {
  const { question, answer } = req.body;
  if (!question || !answer) return res.status(400).json({ error: 'question and answer required' });
  const r = db.prepare('INSERT INTO faqs (shop_id, question, answer) VALUES (?,?,?)').run(req.shop.id, question, answer);
  res.status(201).json({ id: r.lastInsertRowid, question, answer });
});

// GET /api/shop/faqs
router.get('/faqs', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM faqs WHERE shop_id = ? ORDER BY created_at DESC').all(req.shop.id));
});

// DELETE /api/shop/faqs/:id
router.delete('/faqs/:id', auth, (req, res) => {
  const { changes } = db.prepare('DELETE FROM faqs WHERE id = ? AND shop_id = ?').run(req.params.id, req.shop.id);
  if (!changes) return res.status(404).json({ error: 'FAQ not found' });
  res.json({ deleted: true });
});

// GET /api/shop/conversations  (dashboard list)
router.get('/conversations', auth, (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = parseInt(req.query.offset) || 0;
  const total  = db.prepare('SELECT COUNT(*) as c FROM conversations WHERE shop_id = ?').get(req.shop.id).c;
  const rows   = db.prepare(`
    SELECT c.*,
      (SELECT content FROM messages WHERE conversation_id = c.id AND role = 'user' ORDER BY created_at LIMIT 1) AS first_message,
      (SELECT COUNT(*)   FROM messages WHERE conversation_id = c.id)                                             AS message_count,
      (SELECT AVG(ai_score) FROM messages WHERE conversation_id = c.id AND role = 'assistant')                   AS avg_score
    FROM conversations c
    WHERE c.shop_id = ?
    ORDER BY c.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(req.shop.id, limit, offset);
  res.json({ conversations: rows, total });
});

// GET /api/shop/dashboard  (analytics)
router.get('/dashboard', auth, (req, res) => {
  const id    = req.shop.id;
  const since = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

  const convs      = db.prepare('SELECT COUNT(*) as c FROM conversations WHERE shop_id=? AND created_at>?').get(id, since).c;
  const msgs       = db.prepare('SELECT COUNT(*) as c FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.shop_id=? AND m.created_at>?').get(id, since).c;
  const score      = db.prepare("SELECT AVG(m.ai_score) as s FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.shop_id=? AND m.role='assistant' AND m.ai_score IS NOT NULL AND m.created_at>?").get(id, since).s;
  const aiResolved = db.prepare("SELECT COUNT(*) as c FROM conversations WHERE shop_id=? AND status!='transferred' AND created_at>?").get(id, since).c;

  res.json({
    period_days:      30,
    conversations:    convs,
    messages:         msgs,
    ai_score:         score ? Math.round(score * 100) : null,
    ai_resolved_pct:  convs > 0 ? Math.round((aiResolved / convs) * 100) : null,
  });
});

module.exports = router;
