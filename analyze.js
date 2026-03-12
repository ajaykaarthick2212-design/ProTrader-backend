// ═══════════════════════════════════════════════════════
//  ProTrader — Vercel Serverless Function
//  This file keeps your Anthropic API key SECRET on the
//  server. Your frontend calls /api/analyze instead of
//  calling Anthropic directly.
// ═══════════════════════════════════════════════════════

export default async function handler(req, res) {

  // ── Only allow POST requests ──
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── CORS — allow your GitHub Pages site to call this ──
  // Replace YOUR-USERNAME with your actual GitHub username
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { imageBase64, imageMime, timeframe, assetClass, depth } = req.body;

  // ── Validate inputs ──
  if (!imageBase64 || !imageMime) {
    return res.status(400).json({ error: 'Missing image data' });
  }

  // ── Build the AI prompt ──
  const prompt = `You are an elite AI trading analyst. Analyze this trading chart screenshot and predict what happens next.

Context: Timeframe: ${timeframe || '4-hour'} | Asset class: ${assetClass || 'stocks'} | Depth: ${depth || 'standard'}

Analyze: trend direction, chart patterns, candlestick patterns, support/resistance levels, visible indicators (RSI/MACD/MAs/Bollinger Bands/volume), market structure (HH/HL or LH/LL).

Return ONLY valid JSON, no markdown fences, no extra text:
{
  "direction": "BULLISH" or "BEARISH" or "NEUTRAL",
  "confidence": <integer 40-93>,
  "expectedMove": "<e.g. +3.5% or descriptive>",
  "timeToPlay": "<e.g. 2-4 candles or within session>",
  "entryZone": "<specific entry recommendation>",
  "targetZone": "<price target area or percentage>",
  "stopLoss": "<invalidation level>",
  "riskReward": "<e.g. 1:2.1>",
  "patternDetected": "<primary pattern or setup name>",
  "signals": {
    "trend": <0-100>,
    "momentum": <0-100>,
    "volume": <0-100>,
    "patternStrength": <0-100>,
    "riskLevel": <0-100>
  },
  "keyLevels": {
    "strongResistance": "<level>",
    "weakResistance": "<level>",
    "currentPrice": "<approximate>",
    "weakSupport": "<level>",
    "strongSupport": "<level>"
  },
  "analysis": "<4-6 specific sentences referencing what you actually see in the chart>",
  "warningFlags": "<1-2 sentences on what could invalidate this prediction>"
}`;

  try {
    // ── Call Anthropic API using the SECRET key from Vercel env ──
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,   // ← stored safely in Vercel
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: imageMime,
                data: imageBase64
              }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error:', err);
      return res.status(500).json({ error: 'AI service error', detail: err });
    }

    const data = await response.json();
    const raw = data.content.map(b => b.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
