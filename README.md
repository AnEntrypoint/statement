# Gemoci

OCR any image to an OpenDocument Spreadsheet using Gemini AI, with one-click Google sign-in.

**Live**: https://lockhatinc.github.io/statement/

## How it works

1. Sign in with Google — auto-provisions a GCP project + Gemini API key under your account
2. Drop or select an image (max 15 MB)
3. Click **Extract & Download ODS** — Gemini extracts the data, the browser builds and downloads the `.ods` file

No server. All processing runs in your browser.

## File structure

```
index.html          entry point, CDN scripts, UI markup
src/
  app.js            OAuth state machine + UI event wiring
  setup.js          GCP provisioning (project + API key, idempotent)
  ocr.js            Gemini REST call → {headers, rows}
  ods.js            JSZip ODS builder → downloadable blob
.github/workflows/
  deploy.yml        deploy to GitHub Actions Pages
```
