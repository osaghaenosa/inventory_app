const express = require('express');
const { InStock, SoldOut, Debtor } = require('../models/Inventory');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');
const { auth, adminOnly } = require('../middleware/auth');
const router = express.Router();

// In-memory cache: { "2026-03-14": { analysis, source, cachedAt } }
const analysisCache = {};
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

router.post('/analyze', auth, adminOnly, async (req, res) => {
  try {
    const { date, forceRefresh } = req.body;
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Return cached result if available and not expired
    const cached = analysisCache[targetDate];
    if (cached && !forceRefresh) {
      const age = Date.now() - cached.cachedAt;
      if (age < CACHE_TTL_MS) {
        console.log(`AI cache hit for ${targetDate} (${Math.round(age / 1000)}s old)`);
        return res.json({ analysis: cached.analysis, source: cached.source, cached: true });
      }
    }

    // Fetch inventory data
    const inventoryRecords = await Inventory.find({ date: targetDate })
      .populate('worker_id', 'name email');

    const workers = await User.find({ role: 'worker' }).select('name email');

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const activityLogs = await ActivityLog.find({
      timestamp: { $gte: startOfDay, $lte: endOfDay }
    }).populate('user_id', 'name');

    if (inventoryRecords.length === 0) {
      const analysis = `No inventory records found for ${targetDate}. Workers may not have submitted any entries yet.`;
      return res.json({ analysis, source: 'local', cached: false });
    }

    const summaryData = {
      date: targetDate,
      totalRecords: inventoryRecords.length,
      records: inventoryRecords.map(r => ({
        product: r.product_name,
        opening: r.opening_stock,
        added: r.added_stock,
        sold: r.sold_stock,
        remaining: r.remaining_stock,
        worker: r.worker_id?.name || 'Unknown'
      })),
      workerActivity: workers.map(w => ({
        worker: w.name,
        recordsSubmitted: inventoryRecords.filter(
          r => r.worker_id?._id?.toString() === w._id.toString()
        ).length
      })),
      activityCount: activityLogs.length
    };

    const apiKey = process.env.GOOGLE_GENAI_API_KEY;

    if (!apiKey || apiKey === 'your_google_genai_api_key_here') {
      const analysis = generateLocalAnalysis(summaryData);
      analysisCache[targetDate] = { analysis, source: 'local', cachedAt: Date.now() };
      return res.json({ analysis, source: 'local', cached: false });
    }

    const prompt = `You are an inventory management analyst. Analyze this daily inventory data and provide insights.

Data for ${targetDate}:
${JSON.stringify(summaryData, null, 2)}

Provide:
1. **Daily Summary** - Overview of today's inventory activity
2. **Worker Performance** - How each worker performed
3. **Stock Trends** - Products with notable increases/decreases
4. **Suspicious Activity** - Any anomalies
5. **Restocking Recommendations** - Products that may need restocking

Keep it concise and actionable. Use bullet points.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 800 }
        })
      }
    );

    if (!geminiRes.ok) {
      const errData = await geminiRes.json();
      console.error('Gemini API error:', JSON.stringify(errData?.error?.status), errData?.error?.message?.slice(0, 100));

      // On rate limit, return cached if available (even if expired), else local
      if (errData?.error?.code === 429 && cached) {
        console.log('Rate limited — returning stale cache');
        return res.json({ analysis: cached.analysis, source: cached.source, cached: true, stale: true });
      }

      const analysis = generateLocalAnalysis(summaryData);
      analysisCache[targetDate] = { analysis, source: 'local', cachedAt: Date.now() };
      return res.json({ analysis, source: 'local', cached: false });
    }

    const geminiData = await geminiRes.json();
    const analysis = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!analysis) {
      const localAnalysis = generateLocalAnalysis(summaryData);
      return res.json({ analysis: localAnalysis, source: 'local', cached: false });
    }

    // Cache the successful result
    analysisCache[targetDate] = { analysis, source: 'ai', cachedAt: Date.now() };
    console.log(`AI analysis cached for ${targetDate}`);

    res.json({ analysis, source: 'ai', cached: false });

  } catch (err) {
    console.error('AI analyze error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

function generateLocalAnalysis(data) {
  const totalSold = data.records.reduce((s, r) => s + r.sold, 0);
  const totalAdded = data.records.reduce((s, r) => s + r.added, 0);
  const lowStock = data.records.filter(r => r.remaining < 50);

  return `## Inventory Analysis for ${data.date}

**Daily Summary**
- Total records submitted: ${data.totalRecords}
- Total units sold: ${totalSold}
- Total stock added: ${totalAdded}
- Activity log entries: ${data.activityCount}

**Worker Performance**
${data.workerActivity.map(w => `- ${w.worker}: ${w.recordsSubmitted} record(s) submitted`).join('\n') || '- No worker activity'}

**Stock Overview**
${data.records.map(r => `- ${r.product}: Opening ${r.opening}, Added +${r.added}, Sold -${r.sold}, Remaining ${r.remaining}`).join('\n')}

**Restocking Recommendations**
${lowStock.length > 0
    ? lowStock.map(r => `- Alert: ${r.product}: Only ${r.remaining} units remaining — consider restocking`).join('\n')
    : '- All products have adequate stock levels'}

*Add GOOGLE_GENAI_API_KEY to backend/.env for AI-powered analysis.*`;
}

// ── Voice AI Natural Language Command Endpoint ──────────────────────────────
router.post('/command', auth, async (req, res) => {
  try {
    const rawText = req.body.text || req.body.command || req.body.transcript;
    if (!rawText || typeof rawText !== 'string') {
      return res.status(400).json({ message: 'Command text is required' });
    }
    const text = rawText;

    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    // 1. Query: remaining products / stock
    if (
      lower.includes('remaining') ||
      lower.includes('in stock') ||
      lower.includes('left in stock') ||
      lower.includes('stock remaining') ||
      lower.includes('products remaining') ||
      lower.includes('how many items') ||
      lower.includes('check stock')
    ) {
      const stockItems = await InStock.find().sort({ quantity: -1 });
      const totalUnits = stockItems.reduce((acc, r) => acc + (r.quantity || 0), 0);
      const totalProducts = stockItems.length;

      let speechResponse = '';
      if (totalProducts === 0) {
        speechResponse = 'You currently have no products in stock.';
      } else {
        const topFew = stockItems.slice(0, 3).map(i => `${i.item_number} with ${i.quantity} units`).join(', ');
        speechResponse = `You have ${totalProducts} products in stock with a total of ${totalUnits.toLocaleString()} units remaining. Top items include ${topFew}.`;
      }

      return res.json({
        type: 'query_stock',
        intent: 'Products remaining in stock',
        speechResponse,
        data: {
          totalProducts,
          totalUnits,
          items: stockItems.map(i => ({ item_number: i.item_number, quantity: i.quantity, price: i.price }))
        }
      });
    }

    // 2. Query: sold today / what was sold today
    if (
      lower.includes('sold today') ||
      lower.includes('sold out today') ||
      lower.includes('sales today') ||
      lower.includes("today's sales") ||
      lower.includes('what was sold today') ||
      lower.includes('what did we sell today') ||
      lower.includes('ones that was sold today') ||
      lower.includes('products sold today')
    ) {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const salesToday = await SoldOut.find({ date: todayStr }).sort({ createdAt: -1 });

      const totalSold = salesToday.reduce((acc, r) => acc + (r.quantity || 0), 0);
      const totalRevenue = salesToday.reduce((acc, r) => acc + (r.price || 0), 0);

      let speechResponse = '';
      if (salesToday.length === 0) {
        speechResponse = 'No items have been recorded as sold today yet.';
      } else {
        const itemsSummary = salesToday.slice(0, 3).map(s => `${s.quantity} units of ${s.item_number}`).join(', ');
        speechResponse = `Today, you have sold a total of ${totalSold} units across ${salesToday.length} sale${salesToday.length > 1 ? 's' : ''}, generating ${totalRevenue.toLocaleString()} naira in sales. Items sold include: ${itemsSummary}.`;
      }

      return res.json({
        type: 'query_sales_today',
        intent: "Today's sales",
        speechResponse,
        data: {
          totalSold,
          totalRevenue,
          salesCount: salesToday.length,
          items: salesToday.map(s => ({ item_number: s.item_number, quantity: s.quantity, price: s.price, customer: s.customer_info }))
        }
      });
    }

    // 3. Debtor action command e.g. "Abu collected 5 chandelier lights and is owing me 50000" / "and not paid at all"
    const isDebtorAction =
      (lower.includes('collected') || lower.includes('took') || lower.includes('borrowed') || lower.includes('bought on credit')) &&
      (lower.includes('owing') || lower.includes('owes') || lower.includes('not paid') || lower.includes('credit') || lower.includes('hasnt paid') || lower.includes("hasn't paid"));

    const debtorRegex = /(?:([a-zA-Z\s]+?)\s+(?:collected|took|borrowed|bought on credit|received))\s+(\d+)\s*(?:pieces|pcs|units|items|number)?(?:\s+of\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+(?:and\s+is\s+owing|and\s+owes|and\s+not\s+paid|owing|owes)\s*(?:me)?\s*(?:₦|naira)?\s*([\d,]+)?)?$/i;
    const debtorMatch = trimmed.match(debtorRegex);

    if (debtorMatch || isDebtorAction) {
      const allStock = await InStock.find();
      let customerName = debtorMatch?.[1]?.trim() || '';
      customerName = customerName.replace(/^(a customer|someone|somebody|yesterday|today)\s+/i, '').trim();
      if (!customerName || customerName.toLowerCase() === 'someone' || customerName.toLowerCase() === 'somebody') {
        const words = trimmed.split(' ');
        customerName = words[0] || 'Customer';
      }

      let quantity = debtorMatch?.[2] ? Number(debtorMatch[2]) : null;
      let itemNumber = debtorMatch?.[3]?.trim() || '';
      let amount = debtorMatch?.[4] ? Number(debtorMatch[4].replace(/,/g, '')) : null;

      // Extract quantity from text if missing
      if (!quantity) {
        const numMatch = trimmed.match(/\b(\d+)\b/);
        if (numMatch) quantity = Number(numMatch[1]);
      }

      // Clean itemNumber from trailing keywords like "and is owing..."
      if (itemNumber) {
        itemNumber = itemNumber.replace(/\s+(and\s+is\s+owing|and\s+owes|and\s+not\s+paid|owing|owes).*$/i, '').trim();
      }

      // Search matching stock item in text
      if (!itemNumber) {
        for (const stock of allStock) {
          if (lower.includes(stock.item_number.toLowerCase())) {
            itemNumber = stock.item_number;
            break;
          }
        }
      }

      // If itemNumber is still generic or not matched to an exact stock code, try finding nearest stock item
      if (itemNumber) {
        const exact = allStock.find(i => i.item_number.toLowerCase() === itemNumber.toLowerCase());
        if (exact) {
          itemNumber = exact.item_number;
        } else {
          const partial = allStock.find(i => i.item_number.toLowerCase().includes(itemNumber.toLowerCase()) || itemNumber.toLowerCase().includes(i.item_number.toLowerCase()));
          if (partial) itemNumber = partial.item_number;
        }
      } else if (allStock.length > 0) {
        itemNumber = allStock[0].item_number;
      }

      // Extract amount owed if present in text
      if (!amount) {
        const amtMatch = trimmed.match(/(?:owing\s*(?:me)?|owes\s*(?:me)?|amount\s*of)\s*(?:₦|naira)?\s*([\d,]+)/i);
        if (amtMatch) amount = Number(amtMatch[1].replace(/,/g, ''));
      }

      if (!amount && itemNumber) {
        const foundItem = allStock.find(i => i.item_number.toLowerCase() === itemNumber.toLowerCase());
        if (foundItem) {
          amount = foundItem.price * (quantity || 1);
        }
      }

      return res.json({
        type: 'debtor',
        intent: 'Add Debtor Command',
        requiresDialog: true,
        rawText: trimmed,
        speechResponse: `I detected a debtor command for ${customerName}. Please fill in their contact and location details in the dialog to save it.`,
        command: {
          action: 'add_debtor',
          customer_name: customerName,
          item_number: itemNumber || '',
          quantity: quantity || 1,
          amount_owed: amount || 0,
        }
      });
    }

    // 4. Query: debtors / who is owing
    if (
      lower.includes('who is owing') ||
      lower.includes('who owes') ||
      lower.includes('show debtors') ||
      lower.includes('list debtors') ||
      lower.includes('check debtors') ||
      lower.includes('any debtor') ||
      lower.includes('who are the debtors') ||
      lower.includes('all debtors')
    ) {
      const activeDebtors = await Debtor.find({ paid: false }).sort({ price: -1 });
      const totalDebt = activeDebtors.reduce((acc, r) => acc + (r.price || 0), 0);

      let speechResponse = '';
      if (activeDebtors.length === 0) {
        speechResponse = 'There are no active debtors right now. All debts are cleared.';
      } else {
        const topDebtors = activeDebtors.slice(0, 3).map(d => `${d.customer_info} owing ${d.price.toLocaleString()} naira`).join(', ');
        speechResponse = `You have ${activeDebtors.length} active debtor${activeDebtors.length > 1 ? 's' : ''} owing a total of ${totalDebt.toLocaleString()} naira. Notable debtors include: ${topDebtors}.`;
      }

      return res.json({
        type: 'query_debtors',
        intent: 'Active debtors',
        speechResponse,
        data: {
          debtorCount: activeDebtors.length,
          totalDebt,
          debtors: activeDebtors.map(d => ({ customer: d.customer_info, item_number: d.item_number, quantity: d.quantity, amount: d.price }))
        }
      });
    }

    // 5. Sale command e.g. "Somebody bought 300 pieces of ITM-001" or "Sold 20 of Y for 5000"
    const saleRegex = /(?:(?:somebody|someone|customer|a customer|user|buyer)?\s*(?:bought|purchased|sold|sell|recorded sale of)\s+)?(\d+)\s*(?:pieces|pcs|units|items)?(?:\s+of\s+)?([a-zA-Z0-9_\-]+)(?:\s+(?:for|at)\s*(?:₦|naira)?\s*([\d,]+))?/i;
    const saleMatch = trimmed.match(saleRegex);

    if (saleMatch || lower.includes('bought') || lower.includes('sold')) {
      const allStock = await InStock.find();
      let quantity = saleMatch?.[1] ? Number(saleMatch[1]) : 1;
      let itemNumber = saleMatch?.[2]?.trim() || '';
      let price = saleMatch?.[3] ? Number(saleMatch[3].replace(/,/g, '')) : null;

      if (!itemNumber || itemNumber.toLowerCase() === 'item') {
        for (const stock of allStock) {
          if (lower.includes(stock.item_number.toLowerCase())) {
            itemNumber = stock.item_number;
            break;
          }
        }
      }

      const foundStock = allStock.find(s => s.item_number.toLowerCase() === itemNumber.toLowerCase());
      if (foundStock && (!price || price === 0)) {
        price = foundStock.price * quantity;
      }

      return res.json({
        type: 'sale',
        intent: 'Record Sale Command',
        requiresApproval: true,
        rawText: trimmed,
        speechResponse: `I parsed a sale command for ${quantity} pieces of ${itemNumber || 'the item'}. Please review and approve it to record the sale.`,
        command: {
          action: 'record_sale',
          item_number: foundStock ? foundStock.item_number : (itemNumber || ''),
          quantity: quantity || 1,
          price: price || 0,
          customer_info: 'Customer (Voice)'
        }
      });
    }

    // Fallback response
    return res.json({
      type: 'unknown',
      intent: 'General voice input',
      rawText: trimmed,
      speechResponse: `I heard: "${trimmed}". You can ask me for products remaining, sales today, who is owing, or give commands like "Somebody bought 300 pieces of ITM-001".`,
      command: null
    });

  } catch(e) {
    console.error('AI command error:', e.message);
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
