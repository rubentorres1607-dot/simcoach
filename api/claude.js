export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(200).json({ content: [{ type: 'text', text: 'Erro: API key não configurada' }] });

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

    // Tentar modelos gratuitos por ordem
    const models = [
      'nvidia/nemotron-3-ultra-550b-a55b:free',
      'google/gemma-4-31b-it:free',
      'nvidia/nemotron-3.5-lightning:free',
      'openai/gpt-oss-20b:free',
      'poolside/laguna-s-2.1:free',
      'google/gemma-4-26b-a4b-it:free',
    ];

    for (const model of models) {
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
          max_tokens: 1000,
          temperature: 0.3,
          messages: [...systemMsg, ...messages],
        }),
      });

      const raw = await response.text();
      let data;
      try { data = JSON.parse(raw); } catch(e) { continue; }

      if (data.error || !data.choices?.[0]?.message?.content) continue;

      const text = data.choices[0].message.content;
      return res.status(200).json({ content: [{ type: 'text', text }] });
    }

    return res.status(200).json({ content: [{ type: 'text', text: 'Todos os modelos gratuitos indisponíveis de momento. Tenta novamente em alguns minutos.' }] });

  } catch (err) {
    return res.status(200).json({ content: [{ type: 'text', text: 'Erro: ' + err.message }] });
  }
}
