const MODEL = 'gemini-3.1-flash-lite-preview';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_BYTES = 20 * 1024 * 1024;

const PROMPT = `Convert this document into a spreadsheet. One sheet per page.

Return ONLY valid JSON — no markdown, no explanation:
{"pages":[{"name":"Page 1","headers":[...],"rows":[[...],...]},{"name":"Page 2",...}]}

CELL TYPES:
- String: "some text"
- Number: {"type":"number","value":1234.56,"display":"1 234,56"}
- Formula: {"type":"formula","formula":"=B2+C2","display":"1 234,56"}

COMPLETENESS — include every visible element from the document:
- Every header, label, metadata field, value, row, section, footer — nothing omitted
- Reproduce the layout: label-value pairs become two-cell rows; tables become rows with matching columns
- All text verbatim — do not alter, correct, or clean any text
- Blank cells: ""; blank rows: []

PAGE-BREAK STITCHING — handle split rows precisely:
- A split row is one that starts on page N but its remaining columns (amount, balance, or description continuation) appear at the top of page N+1 before any new dated row
- Merge the pieces: place the complete merged row (with all columns filled) as the last data row on page N, using the date from page N
- Page N+1 must begin with its own first complete independent row — do NOT include the merged row again or any fragment of it
- Do not confuse a description continuation at the top of page N+1 with the first row of page N+1; the first actual new row on page N+1 has its own date

NUMBERS — every pure numeric value must be a number object with exact display text from the document.

FORMULAS — when a cell's value is derived from other cells in the same sheet:
- Number rows in your output starting at 1 for the first row of this page
- Running balance (balance[n] = balance[n-1] + amount[n]): seed is a number, each next row is a formula. Balance in col D, amount in col C, row 8: {"type":"formula","formula":"=D7+C8","display":"..."}
- Row numbers in formulas must match actual row indices in the JSON output (1 = first rows[] entry)
- Totals: {"type":"formula","formula":"=SUM(C2:C15)","display":"..."}
- Cross-page first row: use a number object (no cross-sheet references)`;

async function toBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => res(e.target.result.split(',')[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

function coerce(cell) {
  if (cell === null || cell === undefined) return { t: 's', v: '' };
  if (typeof cell === 'string') return { t: 's', v: cell };
  if (typeof cell === 'number') return { t: 'n', v: cell, d: String(cell) };
  if (typeof cell === 'object') {
    if (cell.type === 'number') return { t: 'n', v: Number(cell.value), d: cell.display || String(cell.value) };
    if (cell.type === 'formula') return { t: 'f', f: cell.formula, d: cell.display || '' };
    if (cell.type === 'string') return { t: 's', v: String(cell.value ?? '') };
  }
  return { t: 's', v: String(cell) };
}

function normalize(parsed) {
  if (parsed.pages && Array.isArray(parsed.pages)) {
    return parsed.pages.map((p, i) => ({
      name: p.name || `Page ${i + 1}`,
      headers: Array.isArray(p.headers) ? p.headers.map(h => coerce(h)) : [],
      rows: Array.isArray(p.rows) ? p.rows.map(r => (Array.isArray(r) ? r : [r]).map(coerce)) : []
    }));
  }
  if (Array.isArray(parsed.rows)) {
    return [{
      name: 'Sheet1',
      headers: Array.isArray(parsed.headers) ? parsed.headers.map(h => coerce(h)) : [],
      rows: parsed.rows.map(r => (Array.isArray(r) ? r : [r]).map(coerce))
    }];
  }
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
    return [{
      name: 'Sheet1',
      headers: [coerce('Field'), coerce('Value')],
      rows: Object.entries(parsed).map(([k, v]) => [coerce(k), coerce(String(v))])
    }];
  }
  throw new Error(`Unrecognised response shape: ${JSON.stringify(parsed).slice(0, 200)}`);
}

export async function ocr(file, key) {
  if (file.size > MAX_BYTES) throw new Error(`File too large: ${(file.size/1024/1024).toFixed(1)}MB exceeds 20MB limit`);
  const data = await toBase64(file);
  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: file.type, data } }, { text: PROMPT }] }],
      generation_config: { response_mime_type: 'application/json' }
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini returned no text: ${JSON.stringify(json).slice(0, 300)}`);
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return normalize(JSON.parse(cleaned));
}
