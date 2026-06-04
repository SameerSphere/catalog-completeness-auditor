// Core scoring logic for the Catalog Completeness Auditor.
//
// Pure, dependency-free functions so the exact same logic can run:
//   - locally via the test harness (scripts/test-scoring.js)
//   - inside an n8n "Code" node (see n8n/scoring-code-node.js)
//
// Each of the 5 dimensions contributes up to 20 points => total_score 0..100.

const MAX_PER_DIMENSION = 20;

function wordCount(text) {
  if (!text) return 0;
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

// 1) description_length: reward longer, complete descriptions; full credit at 100+ words.
function scoreDescriptionLength(description) {
  const words = wordCount(description);
  if (words === 0) return 0;
  const ratio = Math.min(words / 100, 1);
  return Math.round(ratio * MAX_PER_DIMENSION);
}

// 2) has_price: 0 if blank or non-positive number, else full credit.
function scoreHasPrice(price) {
  if (isBlank(price)) return 0;
  const num = Number(String(price).replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(num) || num <= 0) return 0;
  return MAX_PER_DIMENSION;
}

// 3) title_quality: ideal 5..20 words; penalize too short / too long / shouty / spammy.
function scoreTitleQuality(title) {
  if (isBlank(title)) return 0;
  const words = wordCount(title);
  let score = MAX_PER_DIMENSION;

  if (words < 5) score -= (5 - words) * 3; // each missing word hurts
  if (words > 20) score -= (words - 20) * 2; // keyword stuffing / too long

  const raw = String(title);
  const letters = raw.replace(/[^a-zA-Z]/g, '');
  const upper = raw.replace(/[^A-Z]/g, '');
  if (letters.length >= 4 && upper.length / letters.length > 0.6) score -= 6; // ALL CAPS
  if (/!{2,}/.test(raw)) score -= 4; // "!!!"

  return Math.max(0, Math.min(MAX_PER_DIMENSION, score));
}

// 4) has_category: 0 if blank, else full credit.
function scoreHasCategory(category) {
  return isBlank(category) ? 0 : MAX_PER_DIMENSION;
}

// 5) description_readability: simple heuristic on sentence length + shoutiness.
//    Sweet spot ~ 10..25 words per sentence. Empty descriptions score 0.
function scoreReadability(description) {
  if (isBlank(description)) return 0;
  const words = wordCount(description);
  if (words < 5) return 4; // too thin to be readable content

  const sentences = String(description)
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const sentenceCount = Math.max(1, sentences.length);
  const avgWordsPerSentence = words / sentenceCount;

  let score = MAX_PER_DIMENSION;
  if (avgWordsPerSentence > 30) score -= 8; // run-on sentences
  else if (avgWordsPerSentence < 6) score -= 5; // choppy / fragmentary

  const letters = String(description).replace(/[^a-zA-Z]/g, '');
  const upper = String(description).replace(/[^A-Z]/g, '');
  if (letters.length >= 10 && upper.length / letters.length > 0.5) score -= 6;

  return Math.max(0, Math.min(MAX_PER_DIMENSION, score));
}

/**
 * Score a single product row.
 * @param {Object} row - { product_id, title, description, price, category }
 * @param {Object} [opts] - { fixThreshold = 60 }
 * @returns {Object} original fields + breakdown, total_score, flag
 */
export function scoreListing(row, opts = {}) {
  const fixThreshold = opts.fixThreshold ?? 60;

  const breakdown = {
    description_length: scoreDescriptionLength(row.description),
    has_price: scoreHasPrice(row.price),
    title_quality: scoreTitleQuality(row.title),
    has_category: scoreHasCategory(row.category),
    description_readability: scoreReadability(row.description),
  };

  const total_score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const flag = total_score < fixThreshold ? 'needs_fix' : 'ok';

  return { ...row, ...breakdown, total_score, flag };
}

export const _internals = {
  wordCount,
  scoreDescriptionLength,
  scoreHasPrice,
  scoreTitleQuality,
  scoreHasCategory,
  scoreReadability,
};
