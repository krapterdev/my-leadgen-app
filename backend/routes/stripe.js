const express = require('express');
const Stripe = require('stripe');
const User = require('../models/User');
const auth = require('../middleware/auth'); // assuming auth middleware is at ../middleware/auth

const stripe = Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock_stripe_key');
const router = express.Router();

/**
 * Create Stripe Checkout Session (Step 16)
 */
router.post('/create-checkout-session', auth, async (req, res) => {
  try {
    const { plan } = req.body; // 'starter' or 'badshah'
    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ message: 'User not found' });

    let stripeCustomerId = user.subscription?.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`
      });
      stripeCustomerId = customer.id;
      user.subscription = {
        ...user.subscription,
        stripeCustomerId
      };
      await user.save();
    }

    // Assign price IDs (using mock or env prices)
    const priceId = plan === 'badshah' 
      ? (process.env.STRIPE_PRICE_BADSHAH || 'price_mock_badshah')
      : (process.env.STRIPE_PRICE_STARTER || 'price_mock_starter');

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings`,
      metadata: {
        userId: user._id.toString(),
        plan
      }
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({ message: 'Stripe integration error', error: error.message });
  }
});

/**
 * Stripe Webhook Handler (Step 16)
 * Note: Needs raw body parsing in server.js to verify webhook signature
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // Fallback/debug parsing when signature is missing (e.g. local testing)
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('Stripe webhook signature validation failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle successful payments
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    const plan = session.metadata?.plan || 'badshah';

    if (userId) {
      try {
        await User.findByIdAndUpdate(userId, {
          'subscription.status': plan,
          'subscription.stripeSubscriptionId': session.subscription
        });
        console.log(`💳 SaaS Subscription Upgraded: User ${userId} upgraded to ${plan.toUpperCase()}`);
      } catch (dbErr) {
        console.error('Failed to update user subscription status in DB:', dbErr);
      }
    }
  }

  res.json({ received: true });
});

module.exports = router;
