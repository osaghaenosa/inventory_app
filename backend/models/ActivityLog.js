const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true
  },
  inventory_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory'
  },
  old_value: {
    type: mongoose.Schema.Types.Mixed
  },
  new_value: {
    type: mongoose.Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const { generatePushNotification } = require('../services/notificationService');

activityLogSchema.post('save', function(doc) {
  if (global.io) {
    generatePushNotification(doc, global.io);
  }
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);
