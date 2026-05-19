const express  = require('express');
const router   = express.Router();
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const db        = require('../db');
const ai        = require('../services/ai');
const tracking  = require('../services/tracking');

// Widget-facing rate limiter: 60 req/min per IP
const widgetLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: req => req.headers['x-forwarded-for'] || req.ip,
  message: { error: 'Too many requests' },
});

// Resolve shop from api_key header (widget calls) or JWT (dashboard calls)
function resolveShop(req, res) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    const shop = db.prepare('SELECT * FROM shops WHERE api_key = ?').get(apiKey);
    if (!shop) { res.status(401).json({ error: 'Invalid API key' }); return null; }
    if (shop.plan === 'trial' && shop.trial_ends_at < Math.floor(Date.now() / 1000)) {
      res.status(402).json({ error: 'Trial expired' }); return null;
    }
    return shop;
  }
  // Dashboard path — auth middleware already set req.shop
  if (req.shop) return req.shop;
  res.status(401).json({ error: 'Unauthorized' });
  return null;
}

// POST /api/conversations  — start a new conversation (widget)
router.post('/', widgetLimiter, (req, res) => {
  const shop = resolveShop(req, res);
  if (!shop) return;

  const { session_id } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO conversations (id, shop_id, session_id) VALUES (?, ?, ?)').run(id, shop.id, session_id || null);
  res.status(201).json({ id, shop_id: shop.id });
});

// POST /api/conversations/:id/messages  — send a message and get AI reply (widget)
router.post('/:id/messages', widgetLimiter, async (req, res) => {
  const shop = resolveShop(req, res);
  if (!shop) return;

  const conv = db.prepare('SELECT * FROM conversations WHERE id = ? AND shop_id = ?').get(req.params.id, shop.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'content required' });

  // Persist user message
  db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').run(conv.id, 'user', content.trim());

  // Load history (last 20 messages for context, AI service will slice to 10)
  const history = db.prepare(
    "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 20"
  ).all(conv.id).reverse();

  // Detect tracking number
  const trackDetect = tracking.detect(content);
  const trackingInfo = trackDetect ? tracking.getStatus(trackDetect.number, trackDetect.carrier) : null;

  let aiContent, tokens, score;
  try {
    ({ content: aiContent, tokens, score } = await ai.chat(shop, history, trackingInfo));
  } catch (err) {
    console.error('OpenAI error:', err.message);
    return res.status(502).json({ error: 'AI service unavailable' });
  }

  // Persist assistant message
  db.prepare('INSERT INTO messages (conversation_id, role, content, ai_score, tokens_used) VALUES (?, ?, ?, ?, ?)')
    .run(conv.id, 'assistant', aiContent, score, tokens);

  // Update conversation timestamp
  db.prepare('UPDATE conversations SET updated_at = unixepoch() WHERE id = ?').run(conv.id);

  res.json({ role: 'assistant', content: aiContent, score, tokens });
});

// GET /api/conversations/:id  — full conversation (dashboard)
router.get('/:id', (req, res) => {
  if (!req.shop) return res.status(401).json({ error: 'Unauthorized' });
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ? AND shop_id = ?').get(req.params.id, req.shop.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at').all(conv.id);
  res.json({ ...conv, messages });
});

// PATCH /api/conversations/:id  — update status (e.g. transfer to operator)
router.patch('/:id', (req, res) => {
  if (!req.shop) return res.status(401).json({ error: 'Unauthorized' });
  const { status } = req.body;
  if (!['active', 'resolved', 'transferred'].includes(status)) {
    return res.status(400).json({ error: 'invalid status' });
  }
  const { changes } = db.prepare('UPDATE conversations SET status = ? WHERE id = ? AND shop_id = ?')
    .run(status, req.params.id, req.shop.id);
  if (!changes) return res.status(404).json({ error: 'Conversation not found' });
  res.json({ status });
});

module.exports = router;
