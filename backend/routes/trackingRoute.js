const express  = require('express');
const router   = express.Router();
const tracking = require('../services/tracking');

// GET /api/tracking/:number  — detect carrier and return tracking URL
router.get('/:number', (req, res) => {
  const { number } = req.params;
  const detected = tracking.detect(number);
  if (!detected || !detected.number) {
    return res.status(404).json({ error: 'Tracking number not recognized', number });
  }
  const info = tracking.getStatus(detected.number, detected.carrier);
  res.json(info);
});

module.exports = router;
