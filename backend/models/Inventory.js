const mongoose = require('mongoose');

// Table 1: In Stock
const inStockSchema = new mongoose.Schema({
  item_number: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  price: { type: Number, required: true, min: 0 },
  image_url: { type: String, default: '' },
  date: { type: String, required: true },
  worker_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  low_stock_threshold: { type: Number, default: 10 }
}, { timestamps: true });

// Table 2: Sold Out
const soldOutSchema = new mongoose.Schema({
  date: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  item_number: { type: String, required: true, trim: true },
  customer_info: { type: String, default: '', trim: true },
  price: { type: Number, required: true, min: 0 },
  worker_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

// Table 3: Debtors
const debtorSchema = new mongoose.Schema({
  date: { type: String, required: true },
  customer_info: { type: String, required: true, trim: true },
  original_price: { type: Number, required: true, min: 0 }, // total amount owed
  price: { type: Number, required: true, min: 0 },          // current remaining balance
  amount_paid: { type: Number, default: 0 },                // cumulative paid so far
  item_number: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  worker_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  paid: { type: Boolean, default: false },
  payment_history: [{
    amount: Number,
    date: String,
    note: String
  }]
}, { timestamps: true });

// Table 4: Returned Items
const returnedItemSchema = new mongoose.Schema({
  item_number: { type: String, required: true, trim: true },
  date: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  customer_info: { type: String, default: '', trim: true },
  worker_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

// Table 5: Restock Item
const restockItemSchema = new mongoose.Schema({
  item_number: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  price: { type: Number, required: true, min: 0 },
  image_url: { type: String, default: '' },
  date: { type: String, required: true },
  worker_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  low_stock_threshold: { type: Number, default: 10 }
}, { timestamps: true });

module.exports = {
  InStock: mongoose.model('InStock', inStockSchema),
  SoldOut: mongoose.model('SoldOut', soldOutSchema),
  Debtor: mongoose.model('Debtor', debtorSchema),
  ReturnedItem: mongoose.model('ReturnedItem', returnedItemSchema),
  RestockItem: mongoose.model('RestockItem', restockItemSchema)
};
