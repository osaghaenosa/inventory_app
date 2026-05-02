const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Worker or Admin
    required: false
  },
  role: {
    type: String,
    enum: ['admin', 'worker'],
    default: 'admin'
  },
  endpoint: {
    type: String,
    required: true,
    unique: true
  },
  subscription: {
    type: Object,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
