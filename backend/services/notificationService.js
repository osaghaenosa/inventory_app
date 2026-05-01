const ActivityLog = require('../models/ActivityLog');

async function generatePushNotification(logEntry, io) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.warn('OPENROUTER_API_KEY is not set. Push notifications will not be generated.');
      return; // Fallback or ignore if no API key
    }

    const systemPrompt = `You are an AI system responsible for converting business activity logs into clear, useful native push notifications for an inventory system.
Your job is to read activity logs and generate meaningful, human-friendly notifications for the ADMIN only.

STRICT RULES:
Notifications are ONLY for the admin
Always base notifications ONLY on the provided activity logs
Do NOT invent or assume missing data
Keep messages short, clear, and actionable
Maximum of 1 notification per log entry
Avoid repetition if multiple logs are similar
Do NOT generate unnecessary notifications

OUTPUT FORMAT (STRICT JSON):
{
  "notifications": [
    {
      "type": "info | warning | critical",
      "title": "short title",
      "message": "clear explanation of the activity",
      "priority": "low | medium | high"
    }
  ]
}

MAPPING RULES:
ITEM_ADDED → info
ITEM_UPDATED → info
ITEM_DELETED → warning
LOW_STOCK → warning
OUT_OF_STOCK → critical
SALE_COMPLETED → info
LARGE_SALE → info
DEBT_CREATED → warning
PAYMENT_PENDING → warning
PAYMENT_CONFIRMED → info

EXAMPLES:
INPUT:
{
  "action": "ITEM_ADDED",
  "user": "John",
  "item": "Rice",
  "quantity": 50
}
OUTPUT:
{
  "notifications": [
    {
      "type": "info",
      "title": "Stock Added",
      "message": "John added 50 units of Rice",
      "priority": "low"
    }
  ]
}

If the log is not important, return:
{
  "notifications": []
}

NOW PROCESS THIS LOG:
${JSON.stringify(logEntry, null, 2)}`;

    const aiRes = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash", // Good fast model on OpenRouter
          messages: [
            { role: "system", content: systemPrompt }
          ],
          response_format: { type: "json_object" },
          temperature: 0.1
        })
      }
    );

    if (!aiRes.ok) {
      console.error('OpenRouter API error during notification generation:', await aiRes.text());
      return;
    }

    const aiData = await aiRes.json();
    let textResult = aiData?.choices?.[0]?.message?.content;

    if (textResult) {
      // Clean up markdown fences if necessary (though responseMimeType should help)
      textResult = textResult.replace(/^```json/m, '').replace(/```$/m, '').trim();
      const parsed = JSON.parse(textResult);
      if (parsed.notifications && parsed.notifications.length > 0) {
        parsed.notifications.forEach(notification => {
          io.to('admin-room').emit('ai-notification', notification);
        });
      }
    }
  } catch (err) {
    console.error('Error in AI push notification generation:', err.message);
  }
}

module.exports = { generatePushNotification };
