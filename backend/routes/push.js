const express = require('express');
const webpush = require('web-push');
const jwt = require('jsonwebtoken');
const PushSubscription = require('../models/PushSubscription');
const router = express.Router();

// Configure VAPID details
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Middleware to extract user from token (optional auth)
const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch (e) {
      console.log('Push route: Invalid token');
    }
  }
  next();
};

// ─── GET /api/push/vapid-public-key ────────────────────────────────────────
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// ─── GET /api/push/debug — list stored subscriptions (dev/admin only) ────────
router.get('/debug', async (req, res) => {
  try {
    const subs = await PushSubscription.find({}, { endpoint: 1, role: 1, createdAt: 1 });
    res.json({
      count: subs.length,
      subscriptions: subs.map(s => ({
        role: s.role,
        createdAt: s.createdAt,
        endpoint: s.endpoint.slice(0, 80) + '...',
      }))
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── POST /api/push/subscribe ───────────────────────────────────────────────
router.post('/subscribe', optionalAuth, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ message: 'subscription is required' });
    }

    const userId = req.user ? req.user.id : null;
    const role = req.user ? req.user.role : 'admin'; // default to admin if not logged in but subscribing

    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        user_id: userId,
        role: role,
        subscription,
        endpoint: subscription.endpoint,
      },
      { upsert: true, new: true }
    );

    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (err) {
    console.error('Push subscribe error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ─── DELETE /api/push/unsubscribe ──────────────────────────────────────────
router.post('/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      await PushSubscription.deleteOne({ endpoint });
    }
    res.json({ message: 'Unsubscribed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Helper: send push to all subscribers with a given role ──────────────────
async function sendPushNotification(payload, targetRole = 'admin') {
  try {
    const subs = await PushSubscription.find(targetRole ? { role: targetRole } : {});

    if (subs.length === 0) {
      console.warn(`[Push] No subscriptions found for role="${targetRole}". ` +
        'Open the app on the target device and click "Enable Push" first.');
      return;
    }

    console.log(`[Push] Sending to ${subs.length} subscriber(s) — payload: "${payload.title}"`);

    const deadEndpoints = [];

    await Promise.all(subs.map(async (subDoc) => {
      try {
        await webpush.sendNotification(
          subDoc.subscription,
          JSON.stringify(payload)
        );
        console.log(`[Push] ✓ Delivered to ${subDoc.endpoint.slice(0, 60)}...`);
      } catch (err) {
        const status = err.statusCode || err.status || 'unknown';
        const body   = err.body || err.message || '';

        if (status === 410 || status === 404) {
          // Subscription is gone — clean it up
          console.log(`[Push] Expired subscription removed (${status}): ${subDoc.endpoint.slice(0, 60)}...`);
          deadEndpoints.push(subDoc.endpoint);
        } else if (status === 401) {
          console.error('[Push] ✗ 401 Unauthorised — VAPID keys may be wrong or mismatched. Body:', body);
        } else if (status === 400) {
          console.error('[Push] ✗ 400 Bad Request — subscription object may be malformed. Body:', body);
        } else {
          console.error(`[Push] ✗ Error (${status}) sending to ${subDoc.endpoint.slice(0, 60)}...`);
          console.error('       Details:', body);
        }
      }
    }));

    if (deadEndpoints.length > 0) {
      await PushSubscription.deleteMany({ endpoint: { $in: deadEndpoints } });
      console.log(`[Push] Removed ${deadEndpoints.length} expired subscription(s).`);
    }
  } catch (err) {
    console.error('[Push] sendPushNotification fatal error:', err.message);
  }
}

module.exports = { router, sendPushNotification };
