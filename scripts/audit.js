// Full local pipeline: read CSV -> score -> filter needs_fix -> AI rewrite ->
// write a scored output CSV (the "fix queue").
//
// Usage:
//   node scripts/audit.js                      # uses data/sample_products.csv
//   node scripts/audit.js --limit 5            # only process first 5 rows
//   node scripts/audit.js --mock               # force mock rewrites (no API call)
//   node scripts/audit.js --in path.csv --out output/result.csv
//
// Live rewrites require OPENAI_API_KEY in .env (copy from .env.example).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadEnv } from '../src/env.js';
import { parseCsv, toCsv } from '../src/csv.js';
import { scoreListing } from '../src/scoring.js';
import { rewriteListing } from '../src/rewrite.js';
import { pushToSheets } from '../src/sheets.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
loadEnv(join(root, '.env'));

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

const inPath = arg('in', join(root, 'data', 'sample_products.csv'));
const outPath = arg('out', join(root, 'output', 'fix_queue.csv'));
const limit = arg('limit') ? Number(arg('limit')) : Infinity;
const forceMock = Boolean(arg('mock'));
const pushSheets = Boolean(arg('sheets'));
const threshold = Number(process.env.FIX_THRESHOLD ?? 60);

const apiKey = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY;
const live = !forceMock && Boolean(apiKey);
const model = process.env.LLM_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
const baseUrl = process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1';
console.log(`\nCatalog Auditor — pipeline run`);
console.log(`  input:    ${inPath}`);
console.log(`  rewrites: ${live ? `LIVE (${baseUrl} · ${model})` : 'MOCK (no API call)'}`);

const products = parseCsv(readFileSync(inPath, 'utf8')).slice(0, limit);
const scored = products.map((p) => scoreListing(p, { fixThreshold: threshold }));
const needsFix = scored.filter((r) => r.flag === 'needs_fix');

console.log(`  scored:   ${scored.length} listings, ${needsFix.length} need fixing\n`);

let done = 0;
for (const row of scored) {
  if (row.flag !== 'needs_fix') {
    row.new_title = '';
    row.new_description = '';
    row.seo_keywords = '';
    continue;
  }
  const rewrite = await rewriteListing(
    { title: row.title, description: row.description, category: row.category },
    { mock: forceMock }
  );
  row.new_title = rewrite.new_title;
  row.new_description = rewrite.new_description;
  row.seo_keywords = (rewrite.seo_keywords || []).join(', ');
  done++;
  console.log(`  rewrote ${row.product_id} (${done}/${needsFix.length})`);
}

const columns = [
  'product_id', 'title', 'total_score', 'flag',
  'new_title', 'new_description', 'seo_keywords',
];
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, toCsv(scored, columns));

console.log(`\nDone. Fix queue written to: ${outPath}`);

if (pushSheets) {
  await pushToSheets(scored, columns);
}
if (needsFix.length) {
  const ex = scored.find((r) => r.flag === 'needs_fix');
  console.log(`\nExample rewrite (${ex.product_id}):`);
  console.log(`  before title: ${ex.title}`);
  console.log(`  after  title: ${ex.new_title}`);
  console.log(`  keywords:     ${ex.seo_keywords}`);
}
console.log('');
