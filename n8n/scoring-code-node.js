// ============================================================================
// n8n "Code" node — paste this into a Code node set to: Run Once for All Items.
// Input: items where item.json has { product_id, title, description, price, category }
// Output: same fields + 5 sub-scores + total_score + flag.
// This is the same logic as src/scoring.js, inlined so n8n needs no imports.
// ============================================================================

const MAX = 20;
const FIX_THRESHOLD = 60;

const wordCount = (t) => (t ? String(t).trim().split(/\s+/).filter(Boolean).length : 0);
const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

function scoreDescriptionLength(d) {
  const w = wordCount(d);
  return w === 0 ? 0 : Math.round(Math.min(w / 100, 1) * MAX);
}
function scoreHasPrice(p) {
  if (isBlank(p)) return 0;
  const n = Number(String(p).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) && n > 0 ? MAX : 0;
}
function scoreTitleQuality(title) {
  if (isBlank(title)) return 0;
  const w = wordCount(title);
  let s = MAX;
  if (w < 5) s -= (5 - w) * 3;
  if (w > 20) s -= (w - 20) * 2;
  const raw = String(title);
  const letters = raw.replace(/[^a-zA-Z]/g, '');
  const upper = raw.replace(/[^A-Z]/g, '');
  if (letters.length >= 4 && upper.length / letters.length > 0.6) s -= 6;
  if (/!{2,}/.test(raw)) s -= 4;
  return Math.max(0, Math.min(MAX, s));
}
function scoreHasCategory(c) {
  return isBlank(c) ? 0 : MAX;
}
function scoreReadability(d) {
  if (isBlank(d)) return 0;
  const w = wordCount(d);
  if (w < 5) return 4;
  const sentences = String(d).split(/[.!?]+/).map((x) => x.trim()).filter(Boolean);
  const avg = w / Math.max(1, sentences.length);
  let s = MAX;
  if (avg > 30) s -= 8;
  else if (avg < 6) s -= 5;
  const letters = String(d).replace(/[^a-zA-Z]/g, '');
  const upper = String(d).replace(/[^A-Z]/g, '');
  if (letters.length >= 10 && upper.length / letters.length > 0.5) s -= 6;
  return Math.max(0, Math.min(MAX, s));
}

const __rows = $input.all();
return __rows.map((item) => {
  const row = item.json;
  const breakdown = {
    description_length: scoreDescriptionLength(row.description),
    has_price: scoreHasPrice(row.price),
    title_quality: scoreTitleQuality(row.title),
    has_category: scoreHasCategory(row.category),
    description_readability: scoreReadability(row.description),
  };
  const total_score =
    breakdown.description_length +
    breakdown.has_price +
    breakdown.title_quality +
    breakdown.has_category +
    breakdown.description_readability;
  return {
    json: {
      ...row,
      ...breakdown,
      total_score,
      flag: total_score < FIX_THRESHOLD ? 'needs_fix' : 'ok',
    },
  };
});
