const express    = require('express');
const router     = express.Router();
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const rateLimit  = require('express-rate-limit');
const db         = require('../db');
const auth       = require('../middleware/auth');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many attempts' } });

// POST /api/auth/register
router.post('/register', limiter, async (req, res) => {
  const { email, password, name, website_url } = req.body;

  if (!email || !password)      return res.status(400).json({ error: 'email and password required' });
  if (password.length < 8)      return res.status(400).json({ error: 'password must be at least 8 characters' });
  if (!/\S+@\S+\.\S+/.test(email)) return res.status(400).json({ error: 'invalid email' });

  if (db.prepare('SELECT id FROM shops WHERE owner_email = ?').get(email.toLowerCase())) {
    return res.status(409).json({ error: 'email already registered' });
  }

  const shopId      = uuidv4();
  const apiKey      = uuidv4();
  const passwordHash = await bcrypt.hash(password, 12);
  const trialEndsAt = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;

  db.prepare(`
    INSERT INTO shops (id, owner_email, password_hash, name, website_url, api_key, plan, trial_ends_at)
    VALUES (?, ?, ?, ?, ?, ?, 'trial', ?)
  `).run(shopId, email.toLowerCase(), passwordHash, name || null, website_url || null, apiKey, trialEndsAt);

  const token = jwt.sign({ shopId }, process.env.JWT_SECRET, { expiresIn: '30d' });

  res.status(201).json({
    token,
    shop: { id: shopId, email: email.toLowerCase(), name, api_key: apiKey, plan: 'trial', trial_ends_at: trialEndsAt },
  });
});

// POST /api/auth/login
router.post('/login', limiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const shop = db.prepare('SELECT * FROM shops WHERE owner_email = ?').get(email.toLowerCase());
  if (!shop || !(await bcrypt.compare(password, shop.password_hash))) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const token = jwt.sign({ shopId: shop.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  const { password_hash, ...safe } = shop;
  res.json({ token, shop: safe });
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  const { password_hash, ...safe } = req.shop;
  res.json(safe);
});

module.exports = router;
