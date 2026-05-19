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

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (server-to-server, curl) and configured origins
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Stripe webhook must receive raw body — mount before express.json()
app.use('/api/billing/webhook', require('./routes/billing'));

app.use(express.json({ limit: '1mb' }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/shop',          auth, require('./routes/shop'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/tracking',      require('./routes/trackingRoute'));
app.use('/api/billing',       auth, require('./routes/billing'));

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));

// ── Static frontend (production) ──────────────────────────────────────────────
const staticDir = path.join(__dirname, '..', 'public');
app.use(express.static(staticDir));
app.get('*', (_, res) => {
  const indexPath = path.join(staticDir, 'index.html');
  res.sendFile(indexPath, err => {
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
