/**
 * Rule-based notification service.
 * Parses ActivityLog action strings into clean, human-readable notifications
 * that include the name of the worker who performed the action.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract worker display name from a populated ActivityLog doc.
 * After calling doc.populate('user_id', 'name role'), user_id becomes an object.
 */
function getWorkerName(logEntry) {
  if (logEntry.user_id && typeof logEntry.user_id === 'object' && logEntry.user_id.name) {
    return logEntry.user_id.name;
  }
  return 'Someone';
}

// ── Rule-based parser ─────────────────────────────────────────────────────────

function parseNotification(action, workerName) {
  const a      = action     || '';
  const worker = workerName || 'Someone';

  // ── Restocked via Restock Item route ────────────────────────────────────────
  if (/^Added to Restock Item/i.test(a)) {
    const itemMatch  = a.match(/Restock Item "([^"]+)"/i);
    const qtyMatch   = a.match(/\+(\d+) units/i);
    const totalMatch = a.match(/total stock: (\d+)/i);
    const item  = itemMatch?.[1]  || 'an item';
    const qty   = qtyMatch?.[1]   || '?';
    const total = totalMatch?.[1] || '?';
    return {
      type: 'info',
      title: '📥 Stock Restocked',
      message: `${worker} restocked ${qty} unit(s) of "${item}". Total in stock: ${total}.`,
      priority: 'low',
    };
  }

  // ── New item added to In Stock ───────────────────────────────────────────────
  if (/^Added "[^"]+" to In Stock/i.test(a)) {
    const itemMatch = a.match(/Added "([^"]+)" to In Stock/i);
    const qtyMatch  = a.match(/qty: (\d+)/i);
    const item = itemMatch?.[1] || 'an item';
    const qty  = qtyMatch?.[1]  || '?';
    return {
      type: 'info',
      title: '📦 New Item Added',
      message: `${worker} added "${item}" to stock with ${qty} unit(s).`,
      priority: 'low',
    };
  }

  // ── Stock topped up via In Stock route ───────────────────────────────────────
  if (/^Restocked "[^"]+"/i.test(a)) {
    const itemMatch  = a.match(/Restocked "([^"]+)"/i);
    const qtyMatch   = a.match(/\+(\d+) units/i);
    const totalMatch = a.match(/total: (\d+)/i);
    const item  = itemMatch?.[1]  || 'an item';
    const qty   = qtyMatch?.[1]   || '?';
    const total = totalMatch?.[1] || '?';
    return {
      type: 'info',
      title: '🔄 Stock Topped Up',
      message: `${worker} added ${qty} more unit(s) of "${item}". Total now: ${total}.`,
      priority: 'low',
    };
  }

  // ── Sale recorded ────────────────────────────────────────────────────────────
  if (/^Sold \d+x/i.test(a)) {
    const saleMatch  = a.match(/^Sold (\d+)x "([^"]+)"/i);
    const priceMatch = a.match(/₦([\d,]+)/);
    const remMatch   = a.match(/Stock remaining: (\d+)/i);
    const qty    = saleMatch?.[1]   || '?';
    const item   = saleMatch?.[2]   || 'an item';
    const price  = priceMatch?.[1]  || '?';
    const remain = remMatch?.[1]    || '?';
    const isLow  = Number(remain) <= 5;
    const stockNote = isLow
      ? ` ⚠️ Only ${remain} unit(s) left!`
      : ` Stock remaining: ${remain}.`;
    return {
      type: isLow ? 'warning' : 'info',
      title: '🛒 Sale Recorded',
      message: `${worker} sold ${qty}x "${item}" for ₦${price}.${stockNote}`,
      priority: isLow ? 'high' : 'medium',
    };
  }

  // ── Debtor added ─────────────────────────────────────────────────────────────
  if (/^Debtor added:/i.test(a)) {
    const custMatch  = a.match(/Debtor added: "([^"]+)"/i);
    const qtyMatch   = a.match(/took (\d+)x "([^"]+)"/i);
    const priceMatch = a.match(/worth ₦([\d,]+)/i);
    const remMatch   = a.match(/Stock left: (\d+)/i);
    const customer = custMatch?.[1]  || 'A customer';
    const qty      = qtyMatch?.[1]   || '?';
    const item     = qtyMatch?.[2]   || 'an item';
    const price    = priceMatch?.[1] || '?';
    const remain   = remMatch?.[1]   || '?';
    return {
      type: 'warning',
      title: '💳 New Debtor',
      message: `${worker} recorded that ${customer} took ${qty}x "${item}" worth ₦${price} on credit. Stock left: ${remain}.`,
      priority: 'medium',
    };
  }

  // ── Partial payment ──────────────────────────────────────────────────────────
  if (/^Partial payment:/i.test(a)) {
    const custMatch = a.match(/Partial payment: "([^"]+)"/i);
    const paidMatch = a.match(/paid ₦([\d,]+)/i);
    const remMatch  = a.match(/Remaining: ₦([\d,]+)/i);
    const customer = custMatch?.[1] || 'A customer';
    const paid     = paidMatch?.[1] || '?';
    const remain   = remMatch?.[1]  || '?';
    return {
      type: 'info',
      title: '💰 Payment Received',
      message: `${worker} recorded a ₦${paid} payment from ${customer}. Remaining balance: ₦${remain}.`,
      priority: 'medium',
    };
  }

  // ── Fully paid ───────────────────────────────────────────────────────────────
  if (/"([^"]+)" marked as FULLY PAID/i.test(a)) {
    const custMatch  = a.match(/"([^"]+)" marked as FULLY PAID/i);
    const totalMatch = a.match(/Total: ₦([\d,]+)/i);
    const customer = custMatch?.[1]  || 'A customer';
    const total    = totalMatch?.[1] || '?';
    return {
      type: 'info',
      title: '✅ Debt Cleared',
      message: `${worker} marked ${customer} as fully paid. Total cleared: ₦${total}.`,
      priority: 'low',
    };
  }

  // ── Return recorded ──────────────────────────────────────────────────────────
  if (/^Return:/i.test(a)) {
    const qtyMatch  = a.match(/^Return: (\d+)x "([^"]+)"/i);
    const custMatch = a.match(/from "([^"]+)"/i);
    const remMatch  = a.match(/Stock now: (\d+)/i);
    const qty    = qtyMatch?.[1]  || '?';
    const item   = qtyMatch?.[2]  || 'an item';
    const cust   = custMatch?.[1] || 'a customer';
    const remain = remMatch?.[1]  || '?';
    return {
      type: 'info',
      title: '↩️ Item Returned',
      message: `${worker} recorded a return of ${qty}x "${item}" from ${cust}. Stock now: ${remain}.`,
      priority: 'low',
    };
  }

  // ── Updated sale ─────────────────────────────────────────────────────────────
  if (/^Updated sale of/i.test(a)) {
    const itemMatch = a.match(/Updated sale of "([^"]+)"/i);
    const remMatch  = a.match(/Stock remaining: (\d+)/i);
    const item   = itemMatch?.[1] || 'an item';
    const remain = remMatch?.[1]  || '?';
    return {
      type: 'info',
      title: '✏️ Sale Updated',
      message: `${worker} updated a sale record for "${item}". Stock remaining: ${remain}.`,
      priority: 'low',
    };
  }

  // ── Deleted sale ─────────────────────────────────────────────────────────────
  if (/Deleted sale of/i.test(a)) {
    const itemMatch = a.match(/Deleted sale of "([^"]+)"/i);
    const qtyMatch  = a.match(/(\d+) units returned/i);
    const item = itemMatch?.[1] || 'an item';
    const qty  = qtyMatch?.[1]  || '?';
    return {
      type: 'warning',
      title: '🗑️ Sale Deleted',
      message: `${worker} deleted a sale record for "${item}". ${qty} unit(s) returned to stock.`,
      priority: 'medium',
    };
  }

  // ── Updated In Stock entry ───────────────────────────────────────────────────
  if (/^Updated "[^"]+" in In Stock/i.test(a)) {
    const itemMatch = a.match(/Updated "([^"]+)" in In Stock/i);
    const item = itemMatch?.[1] || 'an item';
    return {
      type: 'info',
      title: '✏️ Stock Updated',
      message: `${worker} updated the stock record for "${item}".`,
      priority: 'low',
    };
  }

  // ── Deleted debtor ───────────────────────────────────────────────────────────
  if (/Deleted.*debtor/i.test(a)) {
    const custMatch = a.match(/debtor "([^"]+)"/i);
    const customer  = custMatch?.[1] || 'a customer';
    return {
      type: 'warning',
      title: '🗑️ Debtor Removed',
      message: `${worker} deleted the debtor record for "${customer}".`,
      priority: 'low',
    };
  }

  // ── Deleted from In Stock ────────────────────────────────────────────────────
  if (/Deleted "[^"]+" from In Stock/i.test(a)) {
    const itemMatch = a.match(/Deleted "([^"]+)" from In Stock/i);
    const item = itemMatch?.[1] || 'an item';
    return {
      type: 'warning',
      title: '🗑️ Item Deleted',
      message: `${worker} removed "${item}" from stock.`,
      priority: 'medium',
    };
  }

  // ── Updated debtor ───────────────────────────────────────────────────────────
  if (/^Updated debtor/i.test(a)) {
    const custMatch = a.match(/Updated debtor "([^"]+)"/i);
    const customer  = custMatch?.[1] || 'a customer';
    return {
      type: 'info',
      title: '✏️ Debtor Updated',
      message: `${worker} updated the debt record for "${customer}".`,
      priority: 'low',
    };
  }

  // ── Generic fallback ─────────────────────────────────────────────────────────
  if (a.length > 5) {
    return {
      type: 'info',
      title: '📋 Activity',
      message: `${worker}: ${a}`,
      priority: 'low',
    };
  }

  return null; // Nothing worth notifying
}

const { sendPushNotification } = require('../routes/push');

async function generatePushNotification(logEntry, io) {
  try {
    const workerName   = getWorkerName(logEntry);
    const action       = logEntry.action || '';
    const notification = parseNotification(action, workerName);

    if (notification) {
      // 1. Live socket for currently open tabs
      io.to('admin-room').emit('ai-notification', notification);
      
      // 2. Real Web Push API for background notifications
      sendPushNotification({
        title: notification.title,
        body: notification.message
      }, 'admin');
    }
  } catch (err) {
    console.error('Error in notification generation:', err.message);
  }
}

module.exports = { generatePushNotification };
