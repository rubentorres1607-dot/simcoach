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

    // Modelos gratuitos verificados em Agosto 2026 (por ordem de qualidade)
    const models = [
      'z-ai/glm-5.2:free',
      'nvidia/nemotron-3-ultra-550b-a55b:free',
      'google/gemma-4-31b-it:free',
      'nvidia/nemotron-3.5-lightning:free',
      'openai/gpt-oss-20b:free',
      'poolside/laguna-s-2.1:free',
    ];

    let lastError = null;
    for (const model of models) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://simcoach.vercel.app',
            'X-Title': 'SimCoach',
          },
          body: JSON.stringify({
            model,
            max_tokens: body.max_tokens || 1200,
            messages: allMessages,
            temperature: 0.3,
          }),
        });

        const data = await response.json();
        if (data.error) { lastError = data.error.message || JSON.stringify(data.error); continue; }

        const text = data.choices?.[0]?.message?.content || '';
        if (!text) { lastError = 'Empty response from ' + model; continue; }

        return res.status(200).json({ content: [{ type: 'text', text }] });
      } catch (e) {
        lastError = e.message;
        continue;
      }
    }

    return res.status(200).json({
      content: [{ type: 'text', text: 'Nenhum modelo disponível: ' + lastError }]
    });

  } catch (err) {
    return res.status(200).json({
      content: [{ type: 'text', text: 'Erro servidor: ' + err.message }]
    });
  }
}
