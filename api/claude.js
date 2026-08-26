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

    const userMessages = body.messages || [];

    // Injectar instrução no system para forçar texto simples
    const systemContent = 'You are a sim racing engineer. IMPORTANT: Respond with plain text only. Do NOT use JSON, do NOT use code blocks, do NOT use curly braces. Use only markdown headers (##) and bullet points (-). Keep responses under 600 words.';

    const messages = [
      { role: 'system', content: systemContent },
      ...userMessages
    ];

    const models = [
      'nvidia/nemotron-3-ultra-550b-a55b:free',
      'google/gemma-4-31b-it:free',
      'nvidia/nemotron-3.5-lightning:free',
      'openai/gpt-oss-20b:free',
      'poolside/laguna-s-2.1:free',
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
            max_tokens: 800,
            temperature: 0.4,
            messages,
          }),
        });

        const raw = await response.text();
        let data;
        try { data = JSON.parse(raw); } catch(e) { continue; }

        if (data.error) continue;

        let text = data.choices?.[0]?.message?.content || '';
        if (!text) continue;

        // Se o modelo gerou JSON mesmo assim, extrair só o texto
        if (text.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(text);
            // Tentar extrair campos de texto
            const parts = [];
            if (parsed.summary || parsed.sum) parts.push(parsed.summary || parsed.sum);
            if (parsed.zones || parsed.z) {
              const zones = parsed.zones || parsed.z || [];
              zones.forEach(function(z) {
                parts.push((z.cause || z.c || '') + ' → ' + (z.fix || z.f || ''));
              });
            }
            if (parts.length > 0) {
              text = parts.join('\n\n');
            }
          } catch(e) {
            // não era JSON válido, usar texto como está
          }
        }

        return res.status(200).json({ content: [{ type: 'text', text }] });
      } catch(e) {
        continue;
      }
    }

    return res.status(200).json({
      content: [{ type: 'text', text: 'Modelos gratuitos temporariamente indisponíveis. Tenta novamente em alguns minutos.' }]
    });

  } catch (err) {
    return res.status(200).json({ content: [{ type: 'text', text: 'Erro: ' + err.message }] });
  }
}
