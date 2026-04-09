const express = require('express');
const { InStock, SoldOut, Debtor, ReturnedItem, RestockItem } = require('../models/Inventory');
const ActivityLog = require('../models/ActivityLog');
const { auth, adminOnly } = require('../middleware/auth');
const router = express.Router();

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

function emitUpdate(req, table, action, worker) {
  try {
    const io = req.app.get('io');
    io.to('admin-room').emit('inventory-update', {
      type: 'update', table,
      message: `${worker} ${action} in ${table}`
    });
  } catch(e) {}
}

async function logActivity(userId, action, data) {
  try {
    await ActivityLog.create({ user_id: userId, action, new_value: data });
  } catch(e) {}
}

/**
 * Find the InStock record for an item_number.
 * Searches globally (not by worker) so cross-worker items are found.
 */
async function findInStockItem(item_number) {
  return await InStock.findOne({
    item_number: { $regex: new RegExp(`^${item_number.trim()}$`, 'i') }
  });
}

/**
 * Deduct quantity from InStock. Returns error string or null on success.
 */
async function deductStock(item_number, qty, session) {
  const stockItem = await findInStockItem(item_number);
  if (!stockItem) {
    return `Item "${item_number}" not found in In Stock. Please add it first.`;
  }
  if (stockItem.quantity < qty) {
    return `Not enough stock for "${item_number}". Available: ${stockItem.quantity}, Requested: ${qty}.`;
  }
  stockItem.quantity -= qty;
  await stockItem.save();
  return null;
}

/**
 * Add quantity back to InStock (for returns/deletions).
 */
async function addStockBack(item_number, qty) {
  const stockItem = await findInStockItem(item_number);
  if (stockItem) {
    stockItem.quantity += qty;
    await stockItem.save();
  }
}

// ─── IN STOCK ─────────────────────────────────────────────────────────────────

router.get('/instock', auth, async (req, res) => {
  try {
    const query = req.user.role === 'worker' ? { worker_id: req.user._id } : {};
    const records = await InStock.find(query).populate('worker_id', 'name').sort({ createdAt: -1 });
    res.json(records);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.post('/instock', auth, async (req, res) => {
  try {
    const { item_number, quantity, price, image_url, low_stock_threshold } = req.body;
    if (!item_number || item_number.trim() === '') return res.status(400).json({ message: 'Item number is required' });
    if (quantity === undefined || quantity === '') return res.status(400).json({ message: 'Quantity is required' });
    if (price === undefined || price === '') return res.status(400).json({ message: 'Price is required' });

    const qty = Number(quantity);
    const pr  = Number(price);
    if (isNaN(qty) || qty < 0) return res.status(400).json({ message: 'Quantity must be a non-negative number' });
    if (isNaN(pr)  || pr  < 0) return res.status(400).json({ message: 'Price must be a non-negative number' });

    // Check if item already exists — update quantity instead of duplicating
    const existing = await findInStockItem(item_number.trim());
    if (existing) {
      existing.quantity += qty;
      if (price !== undefined) existing.price = pr;
      if (image_url) existing.image_url = image_url;
      if (low_stock_threshold) existing.low_stock_threshold = Number(low_stock_threshold);
      await existing.save();
      await existing.populate('worker_id', 'name');
      await logActivity(req.user._id, `Restocked "${item_number}" (+${qty} units, total: ${existing.quantity})`, req.body);
      emitUpdate(req, 'In Stock', `restocked "${item_number}"`, req.user.name);
      return res.status(200).json(existing);
    }

    const record = await InStock.create({
      item_number: item_number.trim(),
      quantity: qty,
      price: pr,
      image_url: image_url || '',
      date: today(),
      worker_id: req.user._id,
      low_stock_threshold: Number(low_stock_threshold) || 10
    });
    await record.populate('worker_id', 'name');
    await logActivity(req.user._id, `Added "${item_number}" to In Stock (qty: ${qty})`, req.body);
    emitUpdate(req, 'In Stock', `added "${item_number}"`, req.user.name);
    res.status(201).json(record);
  } catch(e) {
    console.error('POST /instock error:', e.message);
    res.status(500).json({ message: e.message });
  }
});

router.put('/instock/:id', auth, async (req, res) => {
  try {
    const record = await InStock.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (req.user.role === 'worker' && record.worker_id.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'You can only edit your own records' });

    if (req.body.item_number !== undefined) record.item_number = req.body.item_number.trim();
    if (req.body.quantity !== undefined) record.quantity = Number(req.body.quantity);
    if (req.body.price !== undefined) record.price = Number(req.body.price);
    if (req.body.image_url !== undefined) record.image_url = req.body.image_url;
    if (req.body.low_stock_threshold !== undefined) record.low_stock_threshold = Number(req.body.low_stock_threshold);

    await record.save();
    await record.populate('worker_id', 'name');
    await logActivity(req.user._id, `Updated "${record.item_number}" in In Stock`, req.body);
    emitUpdate(req, 'In Stock', `updated "${record.item_number}"`, req.user.name);
    res.json(record);
  } catch(e) {
    console.error('PUT /instock error:', e.message);
    res.status(500).json({ message: e.message });
  }
});

router.delete('/instock/:id', auth, adminOnly, async (req, res) => {
  try {
    const r = await InStock.findByIdAndDelete(req.params.id);
    if (r) await logActivity(req.user._id, `Deleted "${r.item_number}" from In Stock`, {});
    res.json({ message: 'Deleted' });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ─── SOLD OUT ─────────────────────────────────────────────────────────────────
// Adding a sale: finds item in InStock and deducts quantity
// Deleting a sale: adds quantity back to InStock
// Editing a sale: adjusts the difference in InStock

router.get('/soldout', auth, async (req, res) => {
  try {
    const query = req.user.role === 'worker' ? { worker_id: req.user._id } : {};
    const records = await SoldOut.find(query).populate('worker_id', 'name').sort({ createdAt: -1 });
    res.json(records);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.post('/soldout', auth, async (req, res) => {
  try {
    const { item_number, quantity, customer_info, price } = req.body;
    if (!item_number || item_number.trim() === '') return res.status(400).json({ message: 'Item number is required' });
    if (!quantity || Number(quantity) <= 0) return res.status(400).json({ message: 'Quantity must be greater than 0' });
    if (price === undefined || price === '') return res.status(400).json({ message: 'Price is required' });

    const qty = Number(quantity);
    const pr  = Number(price);

    // Deduct from InStock first — fail early if not enough
    const stockErr = await deductStock(item_number.trim(), qty);
    if (stockErr) return res.status(400).json({ message: stockErr });

    const record = await SoldOut.create({
      date: today(),
      item_number: item_number.trim(),
      quantity: qty,
      customer_info: customer_info || '',
      price: pr,
      worker_id: req.user._id
    });
    await record.populate('worker_id', 'name');

    // Get updated stock level for the log
    const updatedStock = await findInStockItem(item_number.trim());
    const remaining = updatedStock ? updatedStock.quantity : 'N/A';

    await logActivity(req.user._id,
      `Sold ${qty}x "${item_number}" (₦${pr.toLocaleString()}). Stock remaining: ${remaining}`,
      { ...req.body, stock_after: remaining }
    );
    emitUpdate(req, 'Sold Out', `sold ${qty}x "${item_number}" — stock now ${remaining}`, req.user.name);
    res.status(201).json({ record, stockRemaining: remaining });
  } catch(e) {
    console.error('POST /soldout error:', e.message);
    res.status(500).json({ message: e.message });
  }
});

router.put('/soldout/:id', auth, async (req, res) => {
  try {
    const record = await SoldOut.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (req.user.role === 'worker' && record.worker_id.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'You can only edit your own records' });

    const oldQty = record.quantity;
    const oldItem = record.item_number;
    const newQty = req.body.quantity !== undefined ? Number(req.body.quantity) : oldQty;
    const newItem = req.body.item_number ? req.body.item_number.trim() : oldItem;

    // Handle item number change or quantity change
    if (newItem !== oldItem) {
      // Add old qty back to old item
      await addStockBack(oldItem, oldQty);
      // Deduct new qty from new item
      const stockErr = await deductStock(newItem, newQty);
      if (stockErr) {
        // Rollback: re-deduct old item
        await deductStock(oldItem, oldQty);
        return res.status(400).json({ message: stockErr });
      }
    } else if (newQty !== oldQty) {
      const diff = newQty - oldQty;
      if (diff > 0) {
        // Selling more — deduct extra from stock
        const stockErr = await deductStock(oldItem, diff);
        if (stockErr) return res.status(400).json({ message: stockErr });
      } else {
        // Selling less — return the difference to stock
        await addStockBack(oldItem, Math.abs(diff));
      }
    }

    record.item_number = newItem;
    record.quantity = newQty;
    if (req.body.customer_info !== undefined) record.customer_info = req.body.customer_info;
    if (req.body.price !== undefined) record.price = Number(req.body.price);

    await record.save();
    await record.populate('worker_id', 'name');

    const updatedStock = await findInStockItem(newItem);
    const remaining = updatedStock ? updatedStock.quantity : 'N/A';
    await logActivity(req.user._id, `Updated sale of "${newItem}". Stock remaining: ${remaining}`, req.body);
    emitUpdate(req, 'Sold Out', `updated sale of "${newItem}"`, req.user.name);
    res.json(record);
  } catch(e) {
    console.error('PUT /soldout error:', e.message);
    res.status(500).json({ message: e.message });
  }
});

router.delete('/soldout/:id', auth, adminOnly, async (req, res) => {
  try {
    const record = await SoldOut.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    // Add quantity back to InStock when a sale is deleted
    await addStockBack(record.item_number, record.quantity);
    await SoldOut.findByIdAndDelete(req.params.id);
    await logActivity(req.user._id,
      `Deleted sale of "${record.item_number}" — ${record.quantity} units returned to stock`, {}
    );
    res.json({ message: `Sale deleted. ${record.quantity} units returned to "${record.item_number}" stock.` });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ─── DEBTORS ──────────────────────────────────────────────────────────────────
// Adding a debtor deducts stock immediately (item taken, payment pending)
// Partial payment: reduces remaining balance, records payment history
// Full payment (mark paid): removes from active debtors, moves to history
// Delete unpaid: returns stock. Delete paid: no stock change.

router.get('/debtors', auth, async (req, res) => {
  try {
    const query = req.user.role === 'worker' ? { worker_id: req.user._id } : {};
    // Active debtors only (unpaid)
    const records = await Debtor.find({ ...query, paid: false })
      .populate('worker_id', 'name').sort({ createdAt: -1 });
    res.json(records);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// Debtors history (all - paid + unpaid)
router.get('/debtors/history', auth, async (req, res) => {
  try {
    const query = req.user.role === 'worker' ? { worker_id: req.user._id } : {};
    const records = await Debtor.find(query)
      .populate('worker_id', 'name').sort({ updatedAt: -1 });
    res.json(records);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.post('/debtors', auth, async (req, res) => {
  try {
    const { customer_info, price, item_number, quantity } = req.body;
    if (!customer_info || customer_info.trim() === '') return res.status(400).json({ message: 'Customer info is required' });
    if (!item_number || item_number.trim() === '') return res.status(400).json({ message: 'Item number is required' });
    if (!quantity || Number(quantity) <= 0) return res.status(400).json({ message: 'Quantity must be greater than 0' });
    if (!price || Number(price) <= 0) return res.status(400).json({ message: 'Amount owed must be greater than 0' });

    const qty = Number(quantity);
    const pr  = Number(price);

    // Deduct from InStock immediately
    const stockErr = await deductStock(item_number.trim(), qty);
    if (stockErr) return res.status(400).json({ message: stockErr });

    const record = await Debtor.create({
      date: today(),
      customer_info: customer_info.trim(),
      original_price: pr,
      price: pr,
      amount_paid: 0,
      item_number: item_number.trim(),
      quantity: qty,
      worker_id: req.user._id,
      paid: false,
      payment_history: []
    });
    await record.populate('worker_id', 'name');

    const updatedStock = await findInStockItem(item_number.trim());
    const remaining = updatedStock ? updatedStock.quantity : 'N/A';
    await logActivity(req.user._id,
      `Debtor added: "${customer_info}" took ${qty}x "${item_number}" worth ₦${pr.toLocaleString()}. Stock left: ${remaining}`,
      { ...req.body, stock_after: remaining }
    );
    emitUpdate(req, 'Debtors', `"${customer_info}" added as debtor for "${item_number}"`, req.user.name);
    res.status(201).json({ record, stockRemaining: remaining });
  } catch(e) {
    console.error('POST /debtors error:', e.message);
    res.status(500).json({ message: e.message });
  }
});

// Partial payment — reduce balance
router.post('/debtors/:id/pay', auth, async (req, res) => {
  try {
    const { amount, note } = req.body;
    if (!amount || Number(amount) <= 0) return res.status(400).json({ message: 'Payment amount must be greater than 0' });

    const record = await Debtor.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Debtor not found' });
    if (record.paid) return res.status(400).json({ message: 'This debt is already fully paid' });

    const payment = Number(amount);
    if (payment > record.price) return res.status(400).json({
      message: `Payment of ₦${payment.toLocaleString()} exceeds remaining balance of ₦${record.price.toLocaleString()}`
    });

    record.amount_paid += payment;
    record.price -= payment;
    record.payment_history.push({ amount: payment, date: today(), note: note || '' });

    // Auto mark as fully paid if balance is zero
    if (record.price <= 0) {
      record.price = 0;
      record.paid = true;
    }

    await record.save();
    await record.populate('worker_id', 'name');
    await logActivity(req.user._id,
      `Partial payment: "${record.customer_info}" paid ₦${payment.toLocaleString()}. Remaining: ₦${record.price.toLocaleString()}`,
      { amount: payment, remaining: record.price }
    );
    emitUpdate(req, 'Debtors', `"${record.customer_info}" made payment of ₦${payment.toLocaleString()}`, req.user.name);
    res.json(record);
  } catch(e) {
    console.error('POST /debtors/pay error:', e.message);
    res.status(500).json({ message: e.message });
  }
});

// Mark fully paid
router.post('/debtors/:id/markpaid', auth, async (req, res) => {
  try {
    const record = await Debtor.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Debtor not found' });
    if (record.paid) return res.status(400).json({ message: 'Already marked as paid' });

    const remaining = record.price;
    record.amount_paid += remaining;
    record.price = 0;
    record.paid = true;
    record.payment_history.push({ amount: remaining, date: today(), note: 'Marked as fully paid' });

    await record.save();
    await record.populate('worker_id', 'name');
    await logActivity(req.user._id,
      `"${record.customer_info}" marked as FULLY PAID. Total: ₦${record.original_price.toLocaleString()}`,
      { total: record.original_price }
    );
    emitUpdate(req, 'Debtors', `"${record.customer_info}" fully paid off`, req.user.name);
    res.json(record);
  } catch(e) {
    console.error('POST /debtors/markpaid error:', e.message);
    res.status(500).json({ message: e.message });
  }
});

router.put('/debtors/:id', auth, async (req, res) => {
  try {
    const record = await Debtor.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (req.user.role === 'worker' && record.worker_id.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'You can only edit your own records' });

    const oldQty  = record.quantity;
    const oldItem = record.item_number;
    const newQty  = req.body.quantity !== undefined ? Number(req.body.quantity) : oldQty;
    const newItem = req.body.item_number ? req.body.item_number.trim() : oldItem;

    if (newItem !== oldItem) {
      await addStockBack(oldItem, oldQty);
      const stockErr = await deductStock(newItem, newQty);
      if (stockErr) { await deductStock(oldItem, oldQty); return res.status(400).json({ message: stockErr }); }
    } else if (newQty !== oldQty) {
      const diff = newQty - oldQty;
      if (diff > 0) {
        const stockErr = await deductStock(oldItem, diff);
        if (stockErr) return res.status(400).json({ message: stockErr });
      } else { await addStockBack(oldItem, Math.abs(diff)); }
    }

    record.item_number = newItem;
    record.quantity = newQty;
    if (req.body.customer_info !== undefined) record.customer_info = req.body.customer_info;
    if (req.body.price !== undefined) { record.price = Number(req.body.price); record.original_price = Number(req.body.price); }

    await record.save();
    await record.populate('worker_id', 'name');
    await logActivity(req.user._id, `Updated debtor "${record.customer_info}"`, req.body);
    emitUpdate(req, 'Debtors', `updated debtor "${record.customer_info}"`, req.user.name);
    res.json(record);
  } catch(e) {
    console.error('PUT /debtors error:', e.message);
    res.status(500).json({ message: e.message });
  }
});

router.delete('/debtors/:id', auth, async (req, res) => {
  try {
    const record = await Debtor.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (req.user.role === 'worker' && record.worker_id.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'You can only delete your own debtor records' });

    if (!record.paid) {
      await addStockBack(record.item_number, record.quantity);
      await logActivity(req.user._id,
        `Deleted unpaid debtor "${record.customer_info}" — ${record.quantity} units returned to "${record.item_number}" stock`, {}
      );
    } else {
      await logActivity(req.user._id, `Deleted paid debtor record for "${record.customer_info}"`, {});
    }
    await Debtor.findByIdAndDelete(req.params.id);
    res.json({ message: record.paid ? 'Paid debtor record deleted' : `Debtor deleted — ${record.quantity} units returned to stock` });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ─── RESTOCKED ALERT (read-only, calculated) ──────────────────────────────────

router.get('/restocked', auth, async (req, res) => {
  try {
    const query = req.user.role === 'worker' ? { worker_id: req.user._id } : {};
    const items = await InStock.find(query).populate('worker_id', 'name');
    const lowStock = items.filter(i => i.quantity <= i.low_stock_threshold);
    res.json(lowStock);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ─── RETURNED ITEMS ───────────────────────────────────────────────────────────
// Adding a return: adds quantity BACK to InStock
// Deleting a return: deducts from InStock again

router.get('/returned', auth, async (req, res) => {
  try {
    const query = req.user.role === 'worker' ? { worker_id: req.user._id } : {};
    const records = await ReturnedItem.find(query).populate('worker_id', 'name').sort({ createdAt: -1 });
    res.json(records);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.post('/returned', auth, async (req, res) => {
  try {
    const { item_number, quantity, customer_info } = req.body;
    if (!item_number || item_number.trim() === '') return res.status(400).json({ message: 'Item number is required' });
    if (!quantity || Number(quantity) <= 0) return res.status(400).json({ message: 'Quantity must be greater than 0' });

    const qty = Number(quantity);

    // Check item exists in stock
    const stockItem = await findInStockItem(item_number.trim());
    if (!stockItem) return res.status(400).json({ message: `Item "${item_number}" not found in In Stock. Cannot process return.` });

    // Add quantity back to InStock
    await addStockBack(item_number.trim(), qty);

    const record = await ReturnedItem.create({
      item_number: item_number.trim(),
      date: today(),
      quantity: qty,
      customer_info: customer_info || '',
      worker_id: req.user._id
    });
    await record.populate('worker_id', 'name');

    const updatedStock = await findInStockItem(item_number.trim());
    const newTotal = updatedStock ? updatedStock.quantity : 'N/A';
    await logActivity(req.user._id,
      `Return: ${qty}x "${item_number}" from "${customer_info || 'customer'}". Stock now: ${newTotal}`,
      { ...req.body, stock_after: newTotal }
    );
    emitUpdate(req, 'Returned Items', `${qty}x "${item_number}" returned — stock now ${newTotal}`, req.user.name);
    res.status(201).json({ record, stockAfter: newTotal });
  } catch(e) {
    console.error('POST /returned error:', e.message);
    res.status(500).json({ message: e.message });
  }
});

router.put('/returned/:id', auth, async (req, res) => {
  try {
    const record = await ReturnedItem.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (req.user.role === 'worker' && record.worker_id.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'You can only edit your own records' });

    const oldQty  = record.quantity;
    const oldItem = record.item_number;
    const newQty  = req.body.quantity !== undefined ? Number(req.body.quantity) : oldQty;
    const newItem = req.body.item_number ? req.body.item_number.trim() : oldItem;

    // Adjust stock for quantity/item changes
    if (newItem !== oldItem) {
      // Remove old return from old item
      const stockErr = await deductStock(oldItem, oldQty);
      if (stockErr) return res.status(400).json({ message: stockErr });
      // Add new return to new item
      await addStockBack(newItem, newQty);
    } else if (newQty !== oldQty) {
      const diff = newQty - oldQty;
      if (diff > 0) {
        await addStockBack(oldItem, diff);
      } else {
        const stockErr = await deductStock(oldItem, Math.abs(diff));
        if (stockErr) return res.status(400).json({ message: stockErr });
      }
    }

    record.item_number = newItem;
    record.quantity = newQty;
    if (req.body.customer_info !== undefined) record.customer_info = req.body.customer_info;

    await record.save();
    await record.populate('worker_id', 'name');
    await logActivity(req.user._id, `Updated return of "${newItem}"`, req.body);
    res.json(record);
  } catch(e) {
    console.error('PUT /returned error:', e.message);
    res.status(500).json({ message: e.message });
  }
});

router.delete('/returned/:id', auth, adminOnly, async (req, res) => {
  try {
    const record = await ReturnedItem.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    // Deduct the returned quantity from stock (undoing the return)
    await deductStock(record.item_number, record.quantity);
    await ReturnedItem.findByIdAndDelete(req.params.id);
    await logActivity(req.user._id,
      `Deleted return record for "${record.item_number}" — ${record.quantity} units removed from stock`, {}
    );
    res.json({ message: 'Return record deleted' });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ─── RESTOCK ITEM ─────────────────────────────────────────────────────────────

router.get('/restockitem', auth, async (req, res) => {
  try {
    const query = req.user.role === 'worker' ? { worker_id: req.user._id } : {};
    const records = await RestockItem.find(query).populate('worker_id', 'name').sort({ createdAt: -1 });
    res.json(records);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.post('/restockitem', auth, async (req, res) => {
  try {
    const { item_number, quantity, price, image_url, low_stock_threshold } = req.body;
    if (!item_number || item_number.trim() === '') return res.status(400).json({ message: 'Item number is required' });
    if (quantity === undefined || quantity === '') return res.status(400).json({ message: 'Quantity is required' });
    if (price === undefined || price === '') return res.status(400).json({ message: 'Price is required' });

    const qty = Number(quantity);
    const pr  = Number(price);
    if (isNaN(qty) || qty < 0) return res.status(400).json({ message: 'Quantity must be a non-negative number' });
    if (isNaN(pr)  || pr  < 0) return res.status(400).json({ message: 'Price must be a non-negative number' });

    const itemNum = item_number.trim();

    // 1. Update or create RestockItem
    let restockExisting = await RestockItem.findOne({ item_number: { $regex: new RegExp(`^${itemNum}$`, 'i') } });
    let restockRecord;
    if (restockExisting) {
      restockExisting.quantity += qty;
      restockExisting.price += pr; // "added to old price if price exist ... same applies to quantity"
      if (image_url) restockExisting.image_url = image_url;
      if (low_stock_threshold) restockExisting.low_stock_threshold = Number(low_stock_threshold);
      await restockExisting.save();
      restockRecord = restockExisting;
    } else {
      restockRecord = await RestockItem.create({
        item_number: itemNum,
        quantity: qty,
        price: pr,
        image_url: image_url || '',
        date: today(),
        worker_id: req.user._id,
        low_stock_threshold: Number(low_stock_threshold) || 10
      });
    }
    await restockRecord.populate('worker_id', 'name');

    // 2. Update or create InStock
    let inStockExisting = await findInStockItem(itemNum);
    if (inStockExisting) {
      inStockExisting.quantity += qty;
      inStockExisting.price += pr; // Per user request
      if (image_url) inStockExisting.image_url = image_url;
      if (low_stock_threshold) inStockExisting.low_stock_threshold = Number(low_stock_threshold);
      await inStockExisting.save();
    } else {
      await InStock.create({
        item_number: itemNum,
        quantity: qty,
        price: pr,
        image_url: image_url || '',
        date: today(),
        worker_id: req.user._id,
        low_stock_threshold: Number(low_stock_threshold) || 10
      });
    }

    const newTotalStock = inStockExisting ? inStockExisting.quantity : qty;
    await logActivity(req.user._id, `Added to Restock Item "${itemNum}" (+${qty} units), total stock: ${newTotalStock}`, req.body);
    emitUpdate(req, 'Restock Item', `added restock for "${itemNum}"`, req.user.name);

    res.status(201).json(restockRecord);
  } catch(e) {
    console.error('POST /restockitem error:', e.message);
    res.status(500).json({ message: e.message });
  }
});

// ─── ITEM AUTOCOMPLETE ────────────────────────────────────────────────────────

router.get('/items', auth, async (req, res) => {
  try {
    // Always search all items (not just worker's) so item numbers are discoverable
    const items = await InStock.distinct('item_number');
    res.json(items.sort());
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ─── STOCK LOOKUP (for frontend to show current qty when selecting item) ──────

router.get('/stockcheck/:item_number', auth, async (req, res) => {
  try {
    const item = await findInStockItem(req.params.item_number);
    if (!item) return res.json({ found: false, quantity: 0 });
    res.json({ found: true, quantity: item.quantity, price: item.price, item_number: item.item_number });
  } catch(e) { res.status(500).json({ message: e.message }); }
});


// ─── ITEM SEARCH (full profile) ───────────────────────────────────────────────
router.get('/search/:item_number', auth, async (req, res) => {
  try {
    const itemNum = req.params.item_number.trim();
    const regex = new RegExp(`^${itemNum}$`, 'i');
    const isAdmin = req.user.role === 'admin';
    const workerFilter = isAdmin ? {} : { worker_id: req.user._id };

    const [inStock, soldOut, debtors, returned] = await Promise.all([
      InStock.find({ item_number: regex, ...workerFilter }).populate('worker_id', 'name'),
      SoldOut.find({ item_number: regex, ...workerFilter }).populate('worker_id', 'name').sort({ createdAt: -1 }),
      Debtor.find({ item_number: regex, ...workerFilter }).populate('worker_id', 'name').sort({ createdAt: -1 }),
      ReturnedItem.find({ item_number: regex, ...workerFilter }).populate('worker_id', 'name').sort({ createdAt: -1 }),
    ]);

    const stockRecord = inStock[0] || null;
    const totalSold = soldOut.reduce((s, r) => s + r.quantity, 0);
    const totalReturned = returned.reduce((s, r) => s + r.quantity, 0);
    const totalRevenue = soldOut.reduce((s, r) => s + r.price, 0);
    const unpaidDebtors = debtors.filter(d => !d.paid);
    const totalDebt = unpaidDebtors.reduce((s, r) => s + r.price, 0);

    let stockStatus = 'not_found';
    if (stockRecord) {
      if (stockRecord.quantity === 0) stockStatus = 'out_of_stock';
      else if (stockRecord.quantity <= stockRecord.low_stock_threshold) stockStatus = 'low_stock';
      else stockStatus = 'in_stock';
    }

    res.json({
      item_number: itemNum,
      stockRecord,
      stockStatus,
      soldOut,
      debtors,
      returned,
      summary: {
        currentQty: stockRecord?.quantity ?? 0,
        totalSold,
        totalReturned,
        totalRevenue,
        unpaidDebtorCount: unpaidDebtors.length,
        totalDebt,
        price: stockRecord?.price ?? 0,
        lowStockThreshold: stockRecord?.low_stock_threshold ?? 10,
      }
    });
  } catch(e) {
    console.error('Search error:', e.message);
    res.status(500).json({ message: e.message });
  }
});

// ─── CALCULATOR — value totals by date range ──────────────────────────────────
router.post('/calculate', auth, async (req, res) => {
  try {
    const { from, to } = req.body;
    if (!from || !to) return res.status(400).json({ message: 'from and to dates are required' });

    const isAdmin = req.user.role === 'admin';
    const workerFilter = isAdmin ? {} : { worker_id: req.user._id };

    const dateFilter = { date: { $gte: from, $lte: to } };
    const query = { ...workerFilter, ...dateFilter };

    const [soldOut, debtors, returned, inStock] = await Promise.all([
      SoldOut.find(query),
      Debtor.find(query),
      ReturnedItem.find(query),
      InStock.find(workerFilter),
    ]);

    const totalSalesRevenue   = soldOut.reduce((s, r) => s + r.price, 0);
    const totalSalesQty       = soldOut.reduce((s, r) => s + r.quantity, 0);
    const totalDebtValue      = debtors.filter(d => !d.paid).reduce((s, r) => s + r.price, 0);
    const totalDebtQty        = debtors.reduce((s, r) => s + r.quantity, 0);
    const totalReturnedQty    = returned.reduce((s, r) => s + r.quantity, 0);
    const totalStockValue     = inStock.reduce((s, r) => s + (r.quantity * r.price), 0);
    const totalStockQty       = inStock.reduce((s, r) => s + r.quantity, 0);
    const paidDebtors         = debtors.filter(d => d.paid).reduce((s, r) => s + r.price, 0);
    const netRevenue          = totalSalesRevenue + paidDebtors;

    // Group sales by item for breakdown
    const byItem = {};
    soldOut.forEach(r => {
      if (!byItem[r.item_number]) byItem[r.item_number] = { qty: 0, revenue: 0 };
      byItem[r.item_number].qty += r.quantity;
      byItem[r.item_number].revenue += r.price;
    });
    const itemBreakdown = Object.entries(byItem)
      .map(([item, d]) => ({ item, qty: d.qty, revenue: d.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    res.json({
      from, to,
      totalSalesRevenue, totalSalesQty,
      totalDebtValue, totalDebtQty,
      totalReturnedQty,
      totalStockValue, totalStockQty,
      paidDebtors, netRevenue,
      itemBreakdown,
      transactionCount: soldOut.length + debtors.length
    });
  } catch(e) {
    console.error('Calculate error:', e.message);
    res.status(500).json({ message: e.message });
  }
});
module.exports = router;
