// Local test harness for the scoring logic.
// Reads data/sample_products.csv, scores every row, prints a readable table.
// Run with: npm run test:scoring   (or: node scripts/test-scoring.js)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scoreListing } from '../src/scoring.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const csvPath = join(__dirname, '..', 'data', 'sample_products.csv');

// Minimal RFC-4180-ish CSV parser (handles quoted fields, commas, escaped quotes).
function parseCsv(text) {
  const rows = [];
  let field = '';
  let record = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += char;
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      record.push(field); field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      if (field !== '' || record.length > 0) { record.push(field); rows.push(record); }
      field = ''; record = [];
    } else field += char;
  }
  if (field !== '' || record.length > 0) { record.push(field); rows.push(record); }

  const headers = rows.shift();
  return rows.map((r) => Object.fromEntries(headers.map((h, idx) => [h, r[idx] ?? ''])));
}

const products = parseCsv(readFileSync(csvPath, 'utf8'));
const scored = products.map((p) => scoreListing(p));

const pad = (s, n) => String(s).padEnd(n).slice(0, n);
console.log('\nCatalog Completeness Auditor — scoring test\n');
console.log(
  pad('id', 6),
  pad('len', 4),
  pad('price', 6),
  pad('title', 6),
  pad('cat', 4),
  pad('read', 5),
  pad('TOTAL', 6),
  pad('flag', 10),
  'title'
);
console.log('-'.repeat(100));

for (const r of scored) {
  console.log(
    pad(r.product_id, 6),
    pad(r.description_length, 4),
    pad(r.has_price, 6),
    pad(r.title_quality, 6),
    pad(r.has_category, 4),
    pad(r.description_readability, 5),
    pad(r.total_score, 6),
    pad(r.flag, 10),
    String(r.title).slice(0, 45)
  );
}

const needsFix = scored.filter((r) => r.flag === 'needs_fix');
console.log('-'.repeat(100));
console.log(`\n${needsFix.length} of ${scored.length} listings need fixing (score < 60):`);
console.log(needsFix.map((r) => `  • ${r.product_id} (${r.total_score})`).join('\n'));
console.log('');
