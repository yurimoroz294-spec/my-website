require('dotenv').config();
const express   = require('express');
const helmet    = require('helmet');
const cors      = require('cors');
const path      = require('path');
const auth      = require('./middleware/auth');

const app = express();

// ── Security & parsing ────────────────────────────────────────────────────────
app.use(helmet());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

// Dashboard/auth routes — only allow configured origins
const dashboardCors = cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
});

// Widget routes — allow ALL origins (widget runs on any e-shop domain)
const widgetCors = cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] });

// Stripe webhook must receive raw body — mount before express.json()
app.use('/api/billing/webhook', require('./routes/billing'));

app.use(express.json({ limit: '1mb' }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',          dashboardCors, require('./routes/auth'));
app.use('/api/shop',          dashboardCors, auth, require('./routes/shop'));
app.use('/api/conversations', widgetCors,    require('./routes/conversations'));
app.use('/api/tracking',      widgetCors,    require('./routes/trackingRoute'));
app.use('/api/billing',       dashboardCors, auth, require('./routes/billing'));

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));

// ── Static files ──────────────────────────────────────────────────────────────
// Project root: index.html (landing), style.css, main.js
app.use(express.static(path.join(__dirname, '..')));
// public/: dashboard.html, widget.js, widget-test.html (served at /, not /public/)
app.use(express.static(path.join(__dirname, '..', 'public')));

// SPA fallback: unknown routes → landing page
app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'), err => {
    if (err) res.status(404).json({ error: 'Not found' });
  });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Zapi backend running on port ${PORT}`));

module.exports = app;
