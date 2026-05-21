const express    = require('express');
const router     = express.Router();
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const rateLimit  = require('express-rate-limit');
const nodemailer = require('nodemailer');
const db         = require('../db');
const auth       = require('../middleware/auth');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many attempts' } });

function getMailer() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendResetEmail(email, resetUrl) {
  const mailer = getMailer();
  if (!mailer) {
    // Dev fallback — log link to console when SMTP not configured
    console.log(`[PASSWORD RESET] ${email} → ${resetUrl}`);
    return;
  }
  await mailer.sendMail({
    from:    process.env.SMTP_FROM || `"Zapi" <noreply@zapi.cz>`,
    to:      email,
    subject: 'Obnovení hesla — Zapi',
    html: `
      <p>Požádali jste o obnovení hesla pro váš Zapi účet.</p>
      <p><a href="${resetUrl}" style="background:#4f6ef7;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Obnovit heslo</a></p>
      <p style="color:#888;font-size:13px">Odkaz vyprší za 1 hodinu. Pokud jste o reset nepožádali, ignorujte tento email.</p>
    `,
  });
}

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

// POST /api/auth/forgot-password
router.post('/forgot-password', limiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  // Always return 200 to prevent email enumeration
  const shop = db.prepare('SELECT id, owner_email FROM shops WHERE owner_email = ?').get(email.toLowerCase());
  if (!shop) return res.json({ ok: true });

  // Invalidate any existing tokens for this shop
  db.prepare('DELETE FROM password_reset_tokens WHERE shop_id = ?').run(shop.id);

  const token     = uuidv4();
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour
  db.prepare('INSERT INTO password_reset_tokens (token, shop_id, expires_at) VALUES (?, ?, ?)').run(token, shop.id, expiresAt);

  const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/dashboard.html?reset=${token}`;
  try {
    await sendResetEmail(shop.owner_email, resetUrl);
  } catch (err) {
    console.error('Failed to send reset email:', err.message);
    // Don't expose email errors to client
  }

  res.json({ ok: true });
});

// POST /api/auth/reset-password
router.post('/reset-password', limiter, async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'token and password required' });
  if (password.length < 8)  return res.status(400).json({ error: 'password must be at least 8 characters' });

  const row = db.prepare('SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0').get(token);
  if (!row)                                                      return res.status(400).json({ error: 'Invalid or expired token' });
  if (row.expires_at < Math.floor(Date.now() / 1000))           return res.status(400).json({ error: 'Token expired' });

  const hash = await bcrypt.hash(password, 12);
  db.transaction(() => {
    db.prepare('UPDATE shops SET password_hash = ? WHERE id = ?').run(hash, row.shop_id);
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE token = ?').run(token);
  })();

  res.json({ ok: true });
});

module.exports = router;
