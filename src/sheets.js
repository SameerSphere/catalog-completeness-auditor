// Google Sheets writer using a service-account JSON key.
// Implements the JWT-bearer OAuth flow with Node's built-in crypto (no npm deps)
// and writes rows via the Sheets REST API (values.update).
//
// If the credentials file is missing, runs in DRY-RUN mode: prints what it would
// write so the whole pipeline can be tested without Google Cloud setup.

import { readFileSync, existsSync } from 'node:fs';
import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function getAccessToken(creds) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(
    JSON.stringify({
      iss: creds.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const signingInput = `${header}.${claim}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = signer.sign(creds.private_key);
  const assertion = `${signingInput}.${base64url(signature)}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return (await res.json()).access_token;
}

/**
 * Write rows to the first sheet of a spreadsheet.
 * @param {Array<Object>} rows
 * @param {string[]} columns - column order / header
 * @param {Object} opts { sheetId, credsPath, tab = 'Sheet1' }
 */
export async function pushToSheets(rows, columns, opts = {}) {
  const sheetId = opts.sheetId ?? process.env.GOOGLE_SHEET_ID;
  const credsPath = opts.credsPath ?? process.env.GOOGLE_CREDS_PATH ?? './google_creds.json';
  const tab = opts.tab ?? 'Sheet1';

  const values = [columns, ...rows.map((r) => columns.map((c) => r[c] ?? ''))];

  if (!sheetId || !existsSync(credsPath)) {
    console.log(
      `\n[DRY-RUN sheets] would write ${values.length} rows x ${columns.length} cols ` +
        `to sheet "${sheetId ?? '(no GOOGLE_SHEET_ID)'}" tab "${tab}".`
    );
    console.log(`[DRY-RUN sheets] missing: ${!sheetId ? 'sheet id ' : ''}${!existsSync(credsPath) ? 'creds file (' + credsPath + ')' : ''}`);
    return { dryRun: true, rows: values.length };
  }

  const creds = JSON.parse(readFileSync(credsPath, 'utf8'));
  const token = await getAccessToken(creds);

  const range = `${tab}!A1`;
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/` +
    `${encodeURIComponent(range)}?valueInputOption=RAW`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ range, majorDimension: 'ROWS', values }),
  });
  if (!res.ok) {
    throw new Error(`Sheets write error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const out = await res.json();
  console.log(`\nWrote ${out.updatedRows ?? values.length} rows to Google Sheet ${sheetId}.`);
  return { dryRun: false, updated: out.updatedCells };
}
