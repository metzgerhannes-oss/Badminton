# Schmetterlinge: Mehrsprachigkeit und Cloudflare Free

## Scope
Eleven language packs: de, en, fr, uk, ru, zh-Hans, tr, ar, it, es, pl.
Each contains 87 translated common navigation and UI labels. This **does not
yet translate every long UI sentence** or independently validate native
language quality. Untranslated text falls back to German.

## Free architecture

- Shared translation runtime: `i18n.js` in `index.html` and `welcome.html`.
- Same-origin static catalogs: `locales/<locale>.json`, catalog index in
  `locales/manifest.json`. Already compatible with GitHub Pages.
- The selected language is stored in the **separate** localStorage key
  `schmetterlinge.uiLanguage`; existing player data stays untouched.
- Cached catalogs use CacheStorage and are precached by the service worker
  for offline PWA users. If fetch fails, German remains available.
- The UI supports Arabic right-to-left direction. Player names, club names,
  official event titles, DBV IDs and numerical match calculations remain
  unchanged.
- Optional Cloudflare Pages Free static hosting: create a Pages project tied
  to repository `metzgerhannes-oss/Badminton`, branch `main`, output
  directory `locales`, no build command, root `/`. A verified Pages URL
  may be configured as `window.SCHMETTERLINGE_LANGUAGE_BASE_URL` before
  loading `i18n.js`; the same-origin catalogs remain a fallback.
- No paid Cloudflare R2/KV/D1/Workers, translation APIs or additional
  Supabase tables are required.

## External hosting state

The linked Cloudflare account initially had no Pages projects. Attempting
to connect the GitHub repository for Pages through Cloudflare's API returned
error 8000011 (Pages Git installation issue). Reauthorization of the
Cloudflare GitHub integration is required for that route. Do **not** set a
Cloudflare URL before a successful deployment.

## Verification

- `node scripts/validate-i18n.mjs`
- `npx playwright test tests/e2e/i18n.spec.mjs`
- Mobile and Arabic-RTL visual check before calling it fully accepted.
- Expand translation coverage of legacy dynamic sentences incrementally.
- Keep source attribution, result evidence and sport-data semantics intact.
