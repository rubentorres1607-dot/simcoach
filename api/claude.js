export default async function handler(req, res) {
  // Sempre devolver JSON - nunca texto puro
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(200).json({ content: [{ type: 'text', text: 'Method not allowed' }] });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ content: [{ type: 'text', text: 'Erro: API key não configurada no servidor.' }] });
  }

  let body;
  try {
    body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    if (!body) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = JSON.parse(Buffer.concat(chunks).toString());
    }
  } catch(e) {
    return res.status(200).json({ content: [{ type: 'text', text: 'Erro ao ler pedido: ' + e.message }] });
  }

  const messages = body.messages || [];
  const systemMsg = 'You are a sim racing engineer. Reply with plain text using ## headers and - bullet points. Never use JSON or curly braces. Max 500 words.';

  const models = [
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'google/gemma-4-31b-it:free',
    'nvidia/nemotron-3.5-lightning:free',
    'openai/gpt-oss-20b:free',
    'poolside/laguna-s-2.1:free',
    'google/gemma-4-26b-a4b-it:free',
    'moonshotai/kimi-vl-a3b-thinking:free',
  ];

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
          max_tokens: 700,
          temperature: 0.4,
          messages: [
            { role: 'system', content: systemMsg },
            ...messages
          ],
        }),
      });

      let data;
      try {
        const raw = await response.text();
        data = JSON.parse(raw);
      } catch(e) {
        continue; // tentar próximo modelo
      }

      if (data.error) continue;

      const text = data.choices?.[0]?.message?.content || '';
      if (!text) continue;

      return res.status(200).json({ content: [{ type: 'text', text }] });

    } catch(e) {
      continue;
    }
  }

  return res.status(200).json({
    content: [{ type: 'text', text: '## Aviso\nOs modelos gratuitos estão temporariamente indisponíveis. Tenta novamente em alguns minutos.' }]
  });
}
