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

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://simcoach.vercel.app',
        'X-Title': 'SimCoach',
      },
      body: JSON.stringify({
        model: 'z-ai/glm-5.2:free',
        max_tokens: 1000,
        temperature: 0.3,
        messages: [...systemMsg, ...messages],
      }),
    });

    const text_raw = await response.text();
    let data;
    try { data = JSON.parse(text_raw); } 
    catch(e) { return res.status(200).json({ content: [{ type: 'text', text: 'Resposta inválida: ' + text_raw.substring(0,200) }] }); }

    if (data.error) {
      return res.status(200).json({ content: [{ type: 'text', text: 'Erro modelo: ' + (data.error.message || JSON.stringify(data.error)) }] });
    }

    const text = data.choices?.[0]?.message?.content || 'Sem resposta';
    return res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (err) {
    return res.status(200).json({ content: [{ type: 'text', text: 'Erro: ' + err.message }] });
  }
}
