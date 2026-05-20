const jwt = require('jsonwebtoken');
const db  = require('../db');

module.exports = function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(payload.shopId);
    if (!shop) return res.status(401).json({ error: 'Shop not found' });
    req.shop = shop;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
