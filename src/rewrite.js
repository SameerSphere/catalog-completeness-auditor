// AI rewrite layer. Given a weak listing, returns SEO-optimized copy as JSON:
//   { new_title, new_description, seo_keywords: [5 strings] }
//
// Uses the OpenAI Chat Completions API via native fetch (no npm deps).
// If no API key is provided, falls back to a deterministic MOCK so the full
// pipeline can be tested without spending credits.

const SYSTEM_PROMPT =
  'You are an ecommerce copywriter. Rewrite the product title and description ' +
  'to be SEO-optimized, specific, and persuasive. Return JSON with keys: ' +
  'new_title, new_description, seo_keywords (list of 5).';

function mockRewrite({ title, description, category }) {
  const base = (title || 'Product').trim();
  const cat = (category || 'general').trim();
  return {
    new_title: `${base} — Premium ${cat} | Fast Shipping`.slice(0, 120),
    new_description:
      `[MOCK] ${base} crafted for everyday ${cat.toLowerCase()} use. ` +
      `${description ? description.trim() + ' ' : ''}` +
      'Built with quality materials, designed for reliability, and backed by ' +
      'a satisfaction guarantee. Order today and upgrade your setup.',
    seo_keywords: [
      base.split(/\s+/)[0]?.toLowerCase() || 'product',
      cat.toLowerCase(),
      'best ' + cat.toLowerCase(),
      'buy online',
      'free shipping',
    ],
    _mock: true,
  };
}

/**
 * @param {Object} listing { title, description, category }
 * @param {Object} [opts] { apiKey, model = 'gpt-4o-mini', mock = false }
 * @returns {Promise<{new_title, new_description, seo_keywords, _mock?}>}
 */
export async function rewriteListing(listing, opts = {}) {
  // Works with any OpenAI-compatible API (OpenAI, Groq, etc.) by setting the
  // base URL + key + model. Groq is free; see .env.example.
  const baseUrl = (opts.baseUrl ?? process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const apiKey = opts.apiKey ?? process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY;
  const model = opts.model ?? process.env.LLM_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

  if (opts.mock || !apiKey) return mockRewrite(listing);

  const userPrompt =
    `Title: ${listing.title || '(none)'}\n` +
    `Category: ${listing.category || '(none)'}\n` +
    `Description: ${listing.description || '(none)'}`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`LLM API error ${res.status} (${baseUrl}): ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '{}';
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Could not parse model JSON: ${content.slice(0, 200)}`);
  }

  return {
    new_title: parsed.new_title ?? '',
    new_description: parsed.new_description ?? '',
    seo_keywords: Array.isArray(parsed.seo_keywords) ? parsed.seo_keywords : [],
  };
}

export { SYSTEM_PROMPT };
