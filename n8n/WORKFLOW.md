# n8n Workflow — build guide

## Fastest path: import the ready-made workflow
A complete workflow is generated at **`n8n/catalog-auditor.workflow.json`**
(rebuild anytime with `npm run build:n8n`).

1. Start n8n: `npx n8n` → open http://localhost:5678
2. Top-right menu (⋯) → **Import from File** → pick `catalog-auditor.workflow.json`
3. Fix the 3 placeholders (see below), then **Execute Workflow** to test.

**Placeholders to set after import:**
- **AI rewrite (OpenAI)** node → select/create your LLM credential (see below).
- **Append to Google Sheet** node → set your **Sheet ID** + Google credential.
- **Email summary** node → set the recipient `sendTo` + Gmail credential.

### Using Groq (free) instead of OpenAI in n8n
The "AI rewrite" node is an HTTP Request node, so switching providers is easy:
1. Change the node's **URL** to `https://api.groq.com/openai/v1/chat/completions`
2. In the request body change `model` to `llama-3.3-70b-versatile`
3. Set **Authentication → Generic Credential Type → Header Auth**, with
   Name = `Authorization`, Value = `Bearer gsk_your_groq_key`.

(Groq is OpenAI-compatible, so nothing else changes.)

The CSV path in **Read catalog CSV** is preset to this repo's
`data/sample_products.csv`.

---

## Or build it by hand — node reference

The production path runs entirely in n8n. These are the same nodes the importer
creates, in order.

## Node 1 — Schedule Trigger
- Type: **Schedule Trigger**
- Set to run **weekly** (e.g. every Monday 08:00). For demos you can run manually.

## Node 2 — Read the catalog CSV
Two common options:
- **Read/Write Files from Disk** (read) → points at your exported CSV, then
- **Extract From File** (operation: *Extract From CSV*) to turn it into items.

In real client use this Node 2 becomes an **HTTP Request** that fetches the
store's product export (Shopify/BigCommerce API or a signed export URL).

## Node 3 — Code node: SCORING
- Type: **Code**, Mode: **Run Once for All Items**, Language: **JavaScript**
- Paste the contents of [`scoring-code-node.js`](./scoring-code-node.js).
- Output: every item gains `total_score`, `flag`, and the 5 sub-scores.

## Node 4 — Filter: only the bad listings
- Type: **Filter** (or **IF**)
- Condition: `{{ $json.flag }}` **equals** `needs_fix`
  (equivalently `total_score < 60`).
- Only matching items continue to the rewrite node — this controls API spend.

## Node 5 — OpenAI: REWRITE listing
- Type: **OpenAI** node → *Message a Model* (or the **Message a model** action).
- Model: **gpt-4o-mini**
- Enable **JSON output / response format = JSON**.
- **System prompt:**
  > You are an ecommerce copywriter. Rewrite the product title and description to be SEO-optimized, specific, and persuasive. Return JSON with keys: new_title, new_description, seo_keywords (list of 5).
- **User message** (expression):
  ```
  Title: {{ $json.title }}
  Category: {{ $json.category }}
  Description: {{ $json.description }}
  ```
- The model returns JSON with `new_title`, `new_description`, `seo_keywords`.
  Reference them downstream as `{{ $json.message.content.new_title }}` (exact path
  depends on your n8n version — check the node output and adjust).

## Node 6 — Google Sheets (Stage C)
Append the fix queue. Columns: `product_id, title, total_score, flag,
new_title, new_description, seo_keywords`.

## Node 7 — Gmail (Stage D)
Send a summary: "X products need fixing this week."
Use an expression to count flagged items.

---

### Credentials you'll add in n8n
- **OpenAI**: Settings → Credentials → *OpenAI API* → paste your key. (Same key
  as the `.env` used by the local pipeline — n8n stores it in its own credential
  store, not in this repo.)
- **Google Sheets** + **Gmail**: OAuth2 or service-account credentials (Stage C/D).
