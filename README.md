# AI-Powered Product Catalog Completeness Auditor

Scores ecommerce product listings for content quality, uses AI to rewrite the
worst offenders, and publishes a prioritized **fix queue** to Google Sheets —
all orchestrated as an automated **n8n** workflow.

> **The problem it solves:** Online stores lose sales and SEO ranking to thin,
> inconsistent, or missing product content. This workflow audits an entire
> catalog in minutes, tells the team exactly which listings to fix first, and
> hands them ready-to-paste AI-written copy.

This workflow can be deployed for any **Shopify** or **BigCommerce** store with a
product export.

## The workflow (built in n8n)

![Catalog Completeness Auditor workflow in n8n](n8n/n8n-workflow.png)

*The end-to-end agentic workflow: a weekly trigger reads a product catalog, scores
every listing, filters the failures, rewrites them with AI, writes a fix queue to
Google Sheets, and emails a summary — all orchestrated visually in n8n.*

---

## Who it's for & real-world use cases

This is a packageable service for any agency or in-house team managing an
ecommerce catalog. Concrete scenarios:

| Use case | What the workflow delivers |
|----------|----------------------------|
| **Pre-migration content audit** (e.g. moving to BigCommerce/Shopify) | A scored report of every listing so the team fixes weak content *before* it goes live, not after. |
| **Weekly catalog QA** | A scheduled health-check that flags new thin/incomplete listings as the catalog grows — no manual review. |
| **SEO uplift sprint** | A prioritized queue (worst-first) with ready-to-paste AI titles, descriptions, and keywords. |
| **Supplier / dropship feed cleanup** | Auto-rewrites the typically poor copy that comes from supplier product feeds. |
| **Recurring client report** | The Google Sheet + "X products need fixing this week" email is a deliverable a service business can bill for monthly. |

**Why it matters commercially:** content quality directly drives conversion and
SEO ranking. This turns a slow, manual, subjective review into a fast, consistent,
automated workflow — exactly the "manual → AI-assisted" shift agencies sell.

---

## Architecture (n8n-first)

```
Schedule Trigger (weekly)
      │
      ▼
Read CSV  ──► Extract From File ──► Code node: SCORING ──► Filter (score < 60)
                                          │                      │
                                          │                      ▼
                                          │         AI REWRITE (OpenAI or Groq)
                                          │                      │
                                          ▼                      ▼
                                   Google Sheets  ◄──────  Merge results
                                   (append fix queue)
                                          │
                                          ▼
                                 Gmail: "X products need fixing this week"
```

The only custom code is the **scoring Code node** (`n8n/scoring-code-node.js`).
Everything else uses native n8n nodes — keeping it low-code and easy for a client
team to adapt.

## The 5 scoring dimensions (0–100 total, 20 pts each)

| Dimension                 | What it checks |
|---------------------------|----------------|
| `description_length`      | Full credit at 100+ words; scaled down below that, 0 if empty |
| `has_price`               | 0 if blank or non-positive, else full credit |
| `title_quality`           | Ideal 5–20 words; penalizes too short/long, ALL CAPS, `!!!` |
| `has_category`            | 0 if blank, else full credit |
| `description_readability` | Sentence-length heuristic; penalizes run-ons, fragments, shouting |

Anything scoring **below 60** is flagged `needs_fix` and queued for AI rewriting.

---

## Example output (real run on the sample catalog)

Running `node scripts/test-scoring.js` scores every listing and flags the failures:

```
id     len  price  title  cat  read  TOTAL  flag       title
----------------------------------------------------------------------------------------
P001   12   20     20     20   20    92     ok         Stainless Steel Insulated Water Bottle 1L
P002   0    20     8      0    4     32     needs_fix  Bottle
P003   13   20     20     20   20    93     ok         Wireless Bluetooth Over-Ear Headphones...
P004   0    0      10     20   4     34     needs_fix  CHEAP PHONE CASE BUY NOW!!!
P008   13   20     20     20   20    93     ok         Smart LED Desk Lamp with USB Charging Port
P010   0    20     14     20   4     58     needs_fix  GAMING MOUSE RGB 16000 DPI PRO ULTRA...

5 of 12 listings need fixing (score < 60)
```

Then the flagged listings are rewritten by AI (real output, generated with Groq):

| | Before | After |
|---|--------|-------|
| **Title** | `Bottle` | `Premium Glass Water Bottle - 27oz Insulated Hydration Container` |
| **Description** | `Nice bottle.` | `Stay refreshed on-the-go with our premium glass water bottle, featuring a 27oz capacity, insulated design, and BPA-free construction...` |
| **SEO keywords** | — | glass water bottle, insulated bottle, hydration container, refillable bottle, eco-friendly bottle |

| | Before | After |
|---|--------|-------|
| **Title** | `CHEAP PHONE CASE BUY NOW!!!` | `Durable Protective Phone Case Cover for Mobile Devices` |
| **SEO keywords** | — | phone case, mobile accessories, protective cover, cell phone case, smartphone accessories |

Each fix lands in `output/fix_queue.csv` (and the Google Sheet), prioritized
worst-first so a content team knows exactly where to start.

---

## Repo layout

```
data/sample_products.csv     # 12 demo listings (good + intentionally bad)
src/scoring.js               # core scoring logic (shared, dependency-free)
n8n/scoring-code-node.js     # same logic, inlined for an n8n Code node
scripts/test-scoring.js      # local harness to verify scoring (no API keys)
.env.example                 # template for secrets (copy to .env)
```

## Quick start (Stage A — no API keys needed)

```bash
node scripts/test-scoring.js
```

You should see a scored table and a list of listings that need fixing.

---

## Build stages

- **Stage A — Scoring** ✅ — score listings, flag the bad ones. No keys.
- **Stage B — AI rewrite** ✅ — OpenAI rewrites flagged listings (live needs `OPENAI_API_KEY`; mock works without).
- **Stage C — Google Sheets** ✅ — `pushToSheets()` writes the fix queue (live needs service-account JSON; dry-run works without). See `docs/GOOGLE_SHEETS_SETUP.md`.
- **Stage D — n8n + docs** ✅ — importable workflow at `n8n/catalog-auditor.workflow.json`; portfolio one-pager at `docs/PORTFOLIO_ONE_PAGER.md`.

### Handy commands
```bash
npm run test:scoring     # score the sample CSV, print a table
npm run audit:mock       # full pipeline with mock AI (no keys)
node scripts/audit.js --limit 5            # live AI rewrite (needs a Groq or OpenAI key)
node scripts/audit.js --mock --sheets      # also write to Google Sheet
npm run build:n8n        # regenerate the importable n8n workflow
```

### What you (the human) need to provide as we go

| Stage | You provide |
|-------|-------------|
| B | A free **Groq** key (or OpenAI key) → put in `.env` (see `.env.example`) |
| C | Google Cloud service account JSON (`google_creds.json`) + a Sheet ID, shared with the service-account email |
| D | A running n8n (`npx n8n`), and a screenshot of the workflow canvas |

I'll give you an exact checklist at each stage.
