// Tiny dependency-free CSV utilities (RFC-4180-ish): parse + stringify.

export function parseCsv(text) {
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

  const headers = rows.shift() ?? [];
  return rows.map((r) => Object.fromEntries(headers.map((h, idx) => [h, r[idx] ?? ''])));
}

function escapeField(value) {
  const s = value === undefined || value === null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows, headers) {
  if (rows.length === 0) return (headers ?? []).join(',') + '\n';
  const cols = headers ?? Object.keys(rows[0]);
  const lines = [cols.join(',')];
  for (const row of rows) lines.push(cols.map((c) => escapeField(row[c])).join(','));
  return lines.join('\n') + '\n';
}
