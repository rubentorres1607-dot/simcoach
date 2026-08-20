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

    // openrouter/auto selecciona automaticamente o melhor modelo gratuito disponível
    // Sem quebrar quando modelos individuais são retirados
    const models = [
      'openrouter/auto',
      'nousresearch/hermes-3-llama-3.1-70b:free',
      'google/gemma-3-12b-it:free',
      'openai/gpt-4o-mini:free',
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
        if (data.error) { lastError = data.error; continue; }

        const text = data.choices?.[0]?.message?.content || '';
        if (!text) { lastError = 'Empty response'; continue; }

        return res.status(200).json({ content: [{ type: 'text', text }] });
      } catch (e) {
        lastError = e.message;
        continue;
      }
    }

    return res.status(200).json({
      content: [{ type: 'text', text: 'Nenhum modelo disponível. Erro: ' + JSON.stringify(lastError) }]
    });

  } catch (err) {
    return res.status(200).json({
      content: [{ type: 'text', text: 'Erro servidor: ' + err.message }]
    });
  }
}
