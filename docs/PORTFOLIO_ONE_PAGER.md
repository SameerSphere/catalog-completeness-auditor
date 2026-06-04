# AI-Powered Product Catalog Completeness Auditor
*One-page overview — paste into Canva/Notion and export as PDF for your application.*

## The problem it solves
Ecommerce stores lose sales and SEO ranking to thin, inconsistent, or incomplete
product listings — and no one has time to audit thousands of them by hand.

## What it does (one line)
Audits an entire product catalog, scores every listing 0–100 on content quality,
auto-rewrites the worst with AI, and delivers a prioritized fix queue to Google
Sheets — on a weekly schedule.

## The pipeline
```
Weekly Trigger → Read CSV → Parse → SCORE (5 dimensions) → Filter "needs_fix"
                                          │                       │
                                          │                  AI Rewrite (OpenAI)
                                          │                       │
                                     Email summary          Google Sheets fix queue
```
*(Replace this with a screenshot of the n8n canvas — that's the visual portfolio piece.)*

## Scoring dimensions (20 pts each = 100)
description length · price present · title quality · category present · readability
Listings under **60** are flagged and queued for an AI rewrite.

## Before / after example
**Before** (scored 32/100 — too short, no category):
> **Title:** Bottle
> **Description:** Nice bottle.

**After** (AI-rewritten, SEO-optimized):
> **Title:** Insulated Stainless Steel Water Bottle 1L — Leakproof, 24h Cold
> **Description:** Stay hydrated anywhere with this 1-liter double-walled
> stainless steel bottle that keeps drinks cold for 24 hours. Leakproof lid,
> scratch-resistant finish, BPA-free, and built to fit car cup holders and gym bags.
> **SEO keywords:** insulated water bottle, stainless steel bottle, leakproof, 1 liter, gym water bottle

*(Generate your own real example by running `node scripts/audit.js --limit 5`
once your OpenAI account has credit, then screenshot the Google Sheet.)*

## Tools used
n8n (orchestration) · OpenAI gpt-4o-mini (rewriting) · Google Sheets API (output)
· Gmail (reporting) · JavaScript (scoring logic)

## Deployment
> This workflow can be deployed for any **Shopify** or **BigCommerce** store with a
> product export — swap the CSV read for an HTTP Request to the store's product API.
