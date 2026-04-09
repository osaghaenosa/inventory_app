const express = require('express');
const ActivityLog = require('../models/ActivityLog');
const { auth, adminOnly } = require('../middleware/auth');
const router = express.Router();

// Admin: get all logs; Worker: get their own logs
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'worker') query.user_id = req.user._id;

    const logs = await ActivityLog.find(query)
      .populate('user_id', 'name email')
      .sort({ timestamp: -1 })
      .limit(200);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
