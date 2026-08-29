export default async function handler(req, res) {
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
    return res.status(200).json({ content: [{ type: 'text', text: 'Erro: API key não configurada.' }] });
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

  // openrouter/free auto-roteia para o melhor modelo gratuito disponível
  // Fallbacks manuais para modelos verificados em Agosto 2026
  const models = [
    'openrouter/auto',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'openai/gpt-oss-20b:free',
    'poolside/laguna-s-2.1:free',
    'poolside/laguna-xs-2.1:free',
    'inclusionai/ling-3.0-flash:free',
    'google/gemma-4-31b-it:free',
  ];

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout por modelo

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
        signal: controller.signal,
      });

      clearTimeout(timeout);

      let data;
      try {
        const raw = await response.text();
        data = JSON.parse(raw);
      } catch(e) {
        continue;
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
    content: [{ type: 'text', text: '## Aviso\nOs modelos gratuitos estão temporariamente indisponíveis. Tenta novamente em alguns minutos.\n\nSe o problema persistir, vai a openrouter.ai/models e verifica os modelos gratuitos disponíveis.' }]
  });
}
