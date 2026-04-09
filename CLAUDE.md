# Gemoci

Static SPA — no server. Runs entirely in the browser.

## Architecture

- `index.html` — entry point, loads GSI + JSZip CDNs, mounts `src/app.js` as ES module
- `src/app.js` — auth state machine, UI events, orchestrates ocr+ods
- `src/ocr.js` — Gemini 2.0 Flash REST call with user Bearer token
- `src/ods.js` — builds ODS (OpenDocument Spreadsheet) blob via JSZip

## Auth

Google Identity Services (GSI) implicit token flow. No backend. Token stored in `window.__state.token` (memory only, cleared on sign-out/page reload).

OAuth scope: `https://www.googleapis.com/auth/cloud-platform` — the `generative-language` scope does not exist and causes `invalid_scope`. GSI script must not have `async` attribute or the module executes before GSI loads.

## Deploy

GitHub Actions Pages deployment (workflow source, not gh-pages branch).
Required GitHub secret: `GOOGLE_CLIENT_ID`.
Live URL: `https://lockhatinc.github.io/statement/`

## Google Cloud setup

1. Create OAuth 2.0 Client ID (Web application type)
2. Add `https://lockhatinc.github.io` as authorized JS origin
3. Enable the Generative Language API
4. Add `cloud-platform` scope to OAuth consent screen Data Access
5. Add `GOOGLE_CLIENT_ID` as a GitHub Actions secret
