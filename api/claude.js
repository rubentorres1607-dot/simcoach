export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    if (!body) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = JSON.parse(Buffer.concat(chunks).toString());
    }

    const messages = body.messages || [];
    const systemMsg = body.system ? [{ role: 'system', content: body.system }] : [];
    const allMessages = [...systemMsg, ...messages];

    // Usar meta-llama/llama-3.3-70b-instruct:free — modelo gratuito mais capaz disponível em Agosto 2026
    // Fallback: openrouter/auto selecciona automaticamente o melhor gratuito
    const model = 'meta-llama/llama-3.3-70b-instruct:free';

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://simcoach.vercel.app',
        'X-Title': 'SimCoach',
      },
      body: JSON.stringify({
        model: model,
        max_tokens: body.max_tokens || 1200,
        messages: allMessages,
        temperature: 0.3,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      // Tentar fallback com outro modelo gratuito
      const fallbackResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://simcoach.vercel.app',
          'X-Title': 'SimCoach',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-maverick:free',
          max_tokens: body.max_tokens || 1200,
          messages: allMessages,
          temperature: 0.3,
        }),
      });
      const fallbackData = await fallbackResp.json();
      const text = fallbackData.choices?.[0]?.message?.content || JSON.stringify(fallbackData);
      return res.status(200).json({ content: [{ type: 'text', text }] });
    }

    const text = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (err) {
    return res.status(200).json({
      content: [{ type: 'text', text: 'Erro: ' + err.message }]
    });
  }
}
