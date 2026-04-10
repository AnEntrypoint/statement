# Gemoci

Static SPA — no server. Runs entirely in the browser.

## Architecture

- `index.html` — entry point, loads local `jszip.min.js`, mounts `src/app.js` as ES module
- `src/app.js` — API key state machine (no-key → has-key → processing), UI events, orchestrates ocr+ods
- `src/ocr.js` — Gemini REST call (`gemini-3.1-flash-lite-preview`) with `?key=` query param auth; returns `sheets[]`
- `src/ods.js` — builds multi-sheet ODS blob via JSZip; supports float, formula, string cell types

## Auth

User pastes their own Gemini API key from aistudio.google.com/api-keys. Key persists in `localStorage`, masked in UI once set. Single "Clear" button to reset.

State machine phases: `no-key` → `has-key` → `processing`.

No OAuth, no GCP provisioning, no server-side secrets.

## Gemini API

`?key={apiKey}` on `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent`. AI Studio free-tier quota tied to the user's API key.

Input: base64 inline_data (image or PDF, up to 20MB). Response: `application/json` with `{"pages":[...]}` structure.

## ODS output

Each page → one ODS sheet. Cell types:
- `{t:'s', v}` → string
- `{t:'n', v, d}` → float with display text
- `{t:'f', f, d}` → formula (`of:=D7+C8`) with display text

Running balance columns output as formulas. Currency values as float cells. Bold header row via `style:name="h"`.

## Prompt

Two-step pipeline: probe call detects cross-page split rows → main call injects merged rows as ground-truth context.

- LAYOUT directive: explicit top-to-bottom reading order — every visible element (header blocks, address areas, section headings, table rows, footers) becomes a row. "COMPLETENESS" alone was insufficient; the model skipped non-table content without the explicit ordering instruction.
- Page-break row stitching: split rows merged onto originating page; fragment removed from page N+1
- Formula detection: running balance = `=D{prev}+C{cur}`, totals as SUM formulas; row numbers are 1-based from first `rows[]` entry including metadata rows
- Number display strings preserved verbatim from document — no artificial sign prefixes added

## Deploy

GitHub Actions Pages deployment (workflow source). No secrets required.
Live URL: `https://lockhatinc.github.io/statement/`
