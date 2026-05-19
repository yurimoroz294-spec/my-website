const OpenAI = require('openai');
const db     = require('../db');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildSystemPrompt(shop, trackingInfo) {
  const cfg       = JSON.parse(shop.config || '{}');
  const shopName  = shop.name || 'náš e-shop';
  const tone      = cfg.tone || 'přátelský a profesionální';
  const complaintUrl = cfg.complaint_url;

  const products = db.prepare(
    'SELECT name, price, description, category, url, in_stock FROM products WHERE shop_id = ? LIMIT 60'
  ).all(shop.id);

  const faqs = db.prepare('SELECT question, answer FROM faqs WHERE shop_id = ?').all(shop.id);

  let prompt = `Jsi zákaznický asistent pro ${shopName}. Vždy odpovídej ve stejném jazyce jako zákazník (výchozí: čeština).

STYL KOMUNIKACE: ${tone}

PRAVIDLA:
- Buď stručný — maximálně 3–4 věty, pokud zákazník nechce víc
- Nedávej medicínské, právní ani finanční poradenství
- Pokud situace je složitá, nabídni přepojení na operátora
${complaintUrl
  ? `- Při reklamaci okamžitě odešli odkaz: ${complaintUrl}`
  : '- Při reklamaci zákazníka odkaz na podporu e-shopu'}
- Nedoporučuj konkurenční produkty
- Pokud produkt není skladem, oznámit a nabídnout alternativu`;

  if (products.length > 0) {
    prompt += `\n\nKATALOG (${products.length} produktů):`;
    for (const p of products) {
      const stock = p.in_stock ? '' : ' [NENÍ SKLADEM]';
      const desc  = p.description ? ` — ${p.description.slice(0, 100)}` : '';
      const cat   = p.category ? ` (${p.category})` : '';
      const link  = p.url ? ` | ${p.url}` : '';
      prompt += `\n- ${p.name}${p.price ? ': ' + p.price + ' Kč' : ''}${stock}${cat}${desc}${link}`;
    }
  }

  if (faqs.length > 0) {
    prompt += '\n\nČASTE DOTAZY:';
    for (const f of faqs) prompt += `\nQ: ${f.question}\nA: ${f.answer}`;
  }

  if (trackingInfo) {
    prompt += `\n\nZÁSILKA (k aktuálnímu dotazu):
Číslo: ${trackingInfo.number || 'neuvedeno'}
Přepravce: ${trackingInfo.carrier || 'neznámý'}
Stav: ${trackingInfo.status}${trackingInfo.url ? '\nTracking: ' + trackingInfo.url : ''}`;
  }

  return prompt;
}

function scoreResponse(content, products) {
  let score = 0.70;
  const len = content.length;
  if (len >= 80  && len <= 350) score += 0.10;
  else if (len >= 40)           score += 0.05;
  if (len > 350)                score += 0.03;

  // Mentions a product name
  if (products.some(p => content.toLowerCase().includes(p.name.toLowerCase().slice(0, 8)))) score += 0.08;

  // Helpful language indicators
  if (/doporuč|pomůžu|ráda|samozřejmě|ideální|výborn/i.test(content)) score += 0.05;

  // Contains price
  if (/\d+\s*Kč/i.test(content)) score += 0.04;

  return Math.min(Math.round(score * 100) / 100, 1.0);
}

async function chat(shop, history, trackingInfo = null) {
  const products   = db.prepare('SELECT name FROM products WHERE shop_id = ? LIMIT 60').all(shop.id);
  const systemPrompt = buildSystemPrompt(shop, trackingInfo);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
  ];

  const response = await openai.chat.completions.create({
    model:       'gpt-4o-mini',
    messages,
    max_tokens:  400,
    temperature: 0.7,
  });

  const content = response.choices[0].message.content.trim();
  return {
    content,
    tokens: response.usage.total_tokens,
    score:  scoreResponse(content, products),
  };
}

module.exports = { chat };
