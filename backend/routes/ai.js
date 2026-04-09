const express = require('express');
const Inventory = require('../models/Inventory');
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
    ? lowStock.map(r => `- ⚠️ ${r.product}: Only ${r.remaining} units remaining — consider restocking`).join('\n')
    : '- All products have adequate stock levels'}

*Add GOOGLE_GENAI_API_KEY to backend/.env for AI-powered analysis.*`;
}

module.exports = router;
