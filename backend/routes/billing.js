const express = require('express');
const router  = express.Router();
const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY);
const auth    = require('../middleware/auth');
const db      = require('../db');

// POST /api/billing/subscribe  — create Stripe Checkout session
router.post('/subscribe', auth, async (req, res) => {
  const shop = req.shop;

  let customerId = shop.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: shop.owner_email,
      name:  shop.name || undefined,
      metadata: { shop_id: shop.id },
    });
    customerId = customer.id;
    db.prepare('UPDATE shops SET stripe_customer_id = ? WHERE id = ?').run(customerId, shop.id);
  }

  const session = await stripe.checkout.sessions.create({
    customer:   customerId,
    mode:       'subscription',
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${process.env.APP_URL}/dashboard?checkout=success`,
    cancel_url:  `${process.env.APP_URL}/dashboard?checkout=cancel`,
    subscription_data: {
      metadata: { shop_id: shop.id },
    },
  });

  res.json({ url: session.url });
});

// POST /api/billing/portal  — create Stripe Customer Portal session
router.post('/portal', auth, async (req, res) => {
  const shop = req.shop;
  if (!shop.stripe_customer_id) {
    return res.status(400).json({ error: 'No active subscription' });
  }
  const session = await stripe.billingPortal.sessions.create({
    customer:   shop.stripe_customer_id,
    return_url: `${process.env.APP_URL}/dashboard`,
  });
  res.json({ url: session.url });
});

// POST /api/billing/webhook  — Stripe webhook (raw body required)
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  const sub = event.data?.object;

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const shopId = sub.metadata?.shop_id;
      if (!shopId) break;
      const plan = sub.status === 'active' ? 'pro' : 'trial';
      db.prepare('UPDATE shops SET plan = ?, stripe_subscription_id = ? WHERE id = ?')
        .run(plan, sub.id, shopId);
      break;
    }
    case 'customer.subscription.deleted': {
      const shopId = sub.metadata?.shop_id;
      if (!shopId) break;
      db.prepare("UPDATE shops SET plan = 'trial', stripe_subscription_id = NULL WHERE id = ?").run(shopId);
      break;
    }
    case 'invoice.payment_failed': {
      const customerId = sub.customer;
      db.prepare("UPDATE shops SET plan = 'past_due' WHERE stripe_customer_id = ?").run(customerId);
      break;
    }
  }

  res.json({ received: true });
});

module.exports = router;
