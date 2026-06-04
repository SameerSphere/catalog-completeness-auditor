// Generates an importable n8n workflow JSON from the shared scoring code.
// Run: node scripts/build-n8n-workflow.js
// Output: n8n/catalog-auditor.workflow.json  (Import via n8n -> "Import from File")

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const scoringCode = readFileSync(join(root, 'n8n', 'scoring-code-node.js'), 'utf8');
const csvPath = join(root, 'data', 'sample_products.csv');

const SYSTEM_PROMPT =
  'You are an ecommerce copywriter. Rewrite the product title and description ' +
  'to be SEO-optimized, specific, and persuasive. Return JSON with keys: ' +
  'new_title, new_description, seo_keywords (list of 5).';

// Body for the OpenAI chat completions call, built as an n8n expression string.
const openAiBody =
  "={{ JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.7, " +
  "response_format: { type: 'json_object' }, messages: [ " +
  "{ role: 'system', content: " + JSON.stringify(SYSTEM_PROMPT) + " }, " +
  "{ role: 'user', content: 'Title: ' + ($json.title || '') + " +
  "'\\nCategory: ' + ($json.category || '') + " +
  "'\\nDescription: ' + ($json.description || '') } ] }) }}";

// Code to merge the AI JSON back onto the original scored item (paired item).
const mergeCode = `// Combine the OpenAI response with the original scored listing.
const ai = JSON.parse($json.choices[0].message.content);
const orig = $('Score listings').item.json;
return [{
  json: {
    product_id: orig.product_id,
    title: orig.title,
    total_score: orig.total_score,
    flag: orig.flag,
    new_title: ai.new_title || '',
    new_description: ai.new_description || '',
    seo_keywords: Array.isArray(ai.seo_keywords) ? ai.seo_keywords.join(', ') : '',
  },
}];`;

// Aggregate a single summary item for the weekly email.
const summaryCode = `// Count how many listings need fixing and build one summary item.
const rows = $input.all().map((i) => i.json);
const total = rows.length;
const needsFix = rows.filter((r) => r.flag === 'needs_fix');
return [{
  json: {
    total,
    needs_fix_count: needsFix.length,
    worst: needsFix.sort((a, b) => a.total_score - b.total_score)
      .slice(0, 5).map((r) => r.product_id + ' (' + r.total_score + ')').join(', '),
  },
}];`;

const wf = {
  name: 'Catalog Completeness Auditor',
  nodes: [
    {
      parameters: {
        rule: { interval: [{ field: 'weeks', weeksInterval: 1, triggerAtHour: 8 }] },
      },
      id: 'node-schedule',
      name: 'Weekly Trigger',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.2,
      position: [-100, 300],
    },
    {
      parameters: { operation: 'read', fileSelector: csvPath, options: {} },
      id: 'node-readfile',
      name: 'Read catalog CSV',
      type: 'n8n-nodes-base.readWriteFile',
      typeVersion: 1,
      position: [120, 300],
    },
    {
      parameters: { operation: 'csv', binaryPropertyName: 'data', options: {} },
      id: 'node-extract',
      name: 'Parse CSV',
      type: 'n8n-nodes-base.extractFromFile',
      typeVersion: 1,
      position: [340, 300],
    },
    {
      parameters: { mode: 'runOnceForAllItems', jsCode: scoringCode },
      id: 'node-score',
      name: 'Score listings',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [560, 300],
    },
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
          combinator: 'and',
          conditions: [
            {
              id: 'cond-needsfix',
              leftValue: '={{ $json.flag }}',
              rightValue: 'needs_fix',
              operator: { type: 'string', operation: 'equals' },
            },
          ],
        },
        options: {},
      },
      id: 'node-filter',
      name: 'Only needs_fix',
      type: 'n8n-nodes-base.filter',
      typeVersion: 2,
      position: [780, 180],
    },
    {
      parameters: {
        method: 'POST',
        url: 'https://api.openai.com/v1/chat/completions',
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'openAiApi',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: openAiBody,
        options: {},
      },
      id: 'node-openai',
      name: 'AI rewrite (OpenAI)',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [1000, 180],
      credentials: { openAiApi: { id: 'REPLACE_WITH_YOUR_OPENAI_CREDENTIAL', name: 'OpenAI account' } },
    },
    {
      parameters: { mode: 'runOnceForEachItem', jsCode: mergeCode },
      id: 'node-merge',
      name: 'Merge rewrite',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1220, 180],
    },
    {
      parameters: {
        operation: 'append',
        documentId: { __rl: true, value: 'REPLACE_WITH_YOUR_SHEET_ID', mode: 'id' },
        sheetName: { __rl: true, value: 'Sheet1', mode: 'name' },
        columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [] },
        options: {},
      },
      id: 'node-sheets',
      name: 'Append to Google Sheet',
      type: 'n8n-nodes-base.googleSheets',
      typeVersion: 4.5,
      position: [1440, 180],
    },
    {
      parameters: { mode: 'runOnceForAllItems', jsCode: summaryCode },
      id: 'node-summary',
      name: 'Build summary',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [780, 440],
    },
    {
      parameters: {
        sendTo: 'you@example.com',
        subject: '={{ $json.needs_fix_count }} products need fixing this week',
        emailType: 'text',
        message:
          '=Catalog audit complete.\n\n' +
          'Total listings scored: {{ $json.total }}\n' +
          'Needs fixing (score < 60): {{ $json.needs_fix_count }}\n\n' +
          'Worst offenders: {{ $json.worst }}\n\n' +
          'Full fix queue with AI rewrites is in the Google Sheet.',
        options: {},
      },
      id: 'node-gmail',
      name: 'Email summary',
      type: 'n8n-nodes-base.gmail',
      typeVersion: 2.1,
      position: [1000, 440],
    },
  ],
  connections: {
    'Weekly Trigger': { main: [[{ node: 'Read catalog CSV', type: 'main', index: 0 }]] },
    'Read catalog CSV': { main: [[{ node: 'Parse CSV', type: 'main', index: 0 }]] },
    'Parse CSV': { main: [[{ node: 'Score listings', type: 'main', index: 0 }]] },
    'Score listings': {
      main: [[
        { node: 'Only needs_fix', type: 'main', index: 0 },
        { node: 'Build summary', type: 'main', index: 0 },
      ]],
    },
    'Only needs_fix': { main: [[{ node: 'AI rewrite (OpenAI)', type: 'main', index: 0 }]] },
    'AI rewrite (OpenAI)': { main: [[{ node: 'Merge rewrite', type: 'main', index: 0 }]] },
    'Merge rewrite': { main: [[{ node: 'Append to Google Sheet', type: 'main', index: 0 }]] },
    'Build summary': { main: [[{ node: 'Email summary', type: 'main', index: 0 }]] },
  },
  settings: { executionOrder: 'v1' },
  pinData: {},
  meta: { templatecredsSetupCompleted: false },
};

const outPath = join(root, 'n8n', 'catalog-auditor.workflow.json');
writeFileSync(outPath, JSON.stringify(wf, null, 2));
console.log(`Wrote ${outPath}`);
console.log(`Nodes: ${wf.nodes.length}, connections from ${Object.keys(wf.connections).length} nodes`);
