const express = require('express');
const Inventory = require('../models/Inventory');
const ActivityLog = require('../models/ActivityLog');
const { auth, adminOnly } = require('../middleware/auth');
const router = express.Router();

function getTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// IMPORTANT: /products must be defined BEFORE /:id routes
// Get all distinct product names for autocomplete
router.get('/products', auth, async (req, res) => {
  try {
    const query = {};
    if (req.user.role === 'worker') query.worker_id = req.user._id;
    const products = await Inventory.distinct('product_name', query);
    res.json(products.sort());
  } catch (err) {
    console.error('GET /products error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Get inventory records
router.get('/', auth, async (req, res) => {
  try {
    const { date, product } = req.query;
    let query = {};
    if (req.user.role === 'worker') query.worker_id = req.user._id;
    if (date) query.date = date;
    if (product) query.product_name = { $regex: product, $options: 'i' };

    const records = await Inventory.find(query)
      .populate('worker_id', 'name email')
      .sort({ date: -1, createdAt: -1 });
    res.json(records);
  } catch (err) {
    console.error('GET /inventory error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Create inventory record
router.post('/', auth, async (req, res) => {
  try {
    const { product_name, opening_stock, added_stock, sold_stock } = req.body;
    const today = getTodayStr();

    const remaining = Number(opening_stock) + Number(added_stock || 0) - Number(sold_stock || 0);
    if (remaining < 0) return res.status(400).json({ message: 'Remaining stock cannot be negative' });

    const record = new Inventory({
      date: today,
      product_name: product_name.trim(),
      opening_stock: Number(opening_stock),
      added_stock: Number(added_stock) || 0,
      sold_stock: Number(sold_stock) || 0,
      remaining_stock: remaining,
      worker_id: req.user._id
    });

    await record.save();
    await record.populate('worker_id', 'name email');

    await ActivityLog.create({
      user_id: req.user._id,
      action: `Added inventory record for "${product_name}"`,
      inventory_id: record._id,
      new_value: { product_name, opening_stock, added_stock, sold_stock, remaining_stock: remaining }
    });

    const io = req.app.get('io');
    const msg = `${req.user.name} added a new record for "${product_name}"`;
    io.to('admin-room').emit('inventory-update', {
      type: 'new',
      record,
      worker: req.user.name,
      message: msg
    });

    res.status(201).json(record);
  } catch (err) {
    console.error('POST /inventory error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Update inventory record
router.put('/:id', auth, async (req, res) => {
  try {
    const record = await Inventory.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });

    const today = getTodayStr();

    if (req.user.role === 'worker') {
      if (record.date !== today) {
        return res.status(403).json({ message: 'This record is locked. You can only edit today\'s records.' });
      }
      if (record.worker_id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'You can only edit your own records.' });
      }
    }

    const oldValue = record.toObject();
    const { product_name, opening_stock, added_stock, sold_stock } = req.body;

    const remaining = Number(opening_stock) + Number(added_stock || 0) - Number(sold_stock || 0);
    if (remaining < 0) return res.status(400).json({ message: 'Remaining stock cannot be negative' });

    record.product_name = (product_name || record.product_name).trim();
    record.opening_stock = Number(opening_stock ?? record.opening_stock);
    record.added_stock = Number(added_stock ?? record.added_stock);
    record.sold_stock = Number(sold_stock ?? record.sold_stock);
    record.remaining_stock = remaining;

    await record.save();
    await record.populate('worker_id', 'name email');

    await ActivityLog.create({
      user_id: req.user._id,
      action: `Updated inventory record for "${record.product_name}"`,
      inventory_id: record._id,
      old_value: oldValue,
      new_value: record.toObject()
    });

    const io = req.app.get('io');
    const msg = `${req.user.name} updated record for "${record.product_name}"`;
    io.to('admin-room').emit('inventory-update', {
      type: 'update',
      record,
      worker: req.user.name,
      message: msg
    });

    res.json(record);
  } catch (err) {
    console.error('PUT /inventory error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Delete record (admin only)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const record = await Inventory.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });

    await ActivityLog.create({
      user_id: req.user._id,
      action: `Deleted inventory record for "${record.product_name}"`,
      inventory_id: record._id,
      old_value: record.toObject()
    });

    await Inventory.findByIdAndDelete(req.params.id);

    res.json({ message: 'Record deleted' });
  } catch (err) {
    console.error('DELETE /inventory error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
