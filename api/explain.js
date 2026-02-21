const fs = require('fs');
const path = require('path');

// Load .env.local fallback for local dev (Vercel production sets env vars directly)
if (!process.env.ANTHROPIC_API_KEY) {
  try {
    const envPath = path.resolve(__dirname, '..', '.env.local');
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) process.env[match[1].trim()] = match[2].trim();
    }
  } catch (_) {}
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const { fen, guesses, topMoves, playerColor, messages: history } = req.body;

    const movesText = topMoves
      .map((m, i) => `${i + 1}. ${m.san} (${m.score})`)
      .join('\n');

    // Build messages: initial context + any follow-up conversation
    const messages = [
      {
        role: 'user',
        content: `FEN: ${fen}\nI play ${playerColor === 'w' ? 'White' : 'Black'}. I played: ${guesses.join(', ')}\nEngine top moves:\n${movesText}`,
      },
    ];
    if (history && history.length > 0) {
      messages.push(...history);
    }

    const isFollowUp = history && history.length > 0;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: isFollowUp ? 400 : 150,
        system:
          'Chess coach. Plain text, no markdown. Initial explanation: 1-2 sentences — why the best move is good, whether the player\'s move was reasonable. Follow-up answers: match the depth of the question, stay concise.',
        messages,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Claude API error' });
    }

    return res.status(200).json({ explanation: data.content[0].text });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get explanation' });
  }
};
