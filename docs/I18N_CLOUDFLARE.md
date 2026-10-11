# Schmetterlinge: Mehrsprachigkeit und Cloudflare Free

## Scope
Eleven language packs: de, en, fr, uk, ru, zh-Hans, tr, ar, it, es, pl.
Catalog v2 contains **320 matching translated text keys per language**. All
user-facing static content of the Home, Settings and Invitation HTML pages,
including lengthy data/privacy explanations and installation instructions,
is covered. Common JavaScript status messages are also translated. Some
runtime strings assembled from variable fragments remain German and will
continue to use the German fallback. Native-language editorial review is
still recommended for legal/privacy wording.

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
- Catalog format version 2 rejects obsolete remote catalogs and falls back
to the bundled same-origin version until the Cloudflare deployment catches up.
- Cloudflare Pages Free static hosting is active at
  `https://schmetterlinge-language-packs.pages.dev`. It follows GitHub
  repository `metzgerhannes-oss/Badminton`, branch `main`, output directory
  `locales`, without a build command or Pages Functions.
- This verified Pages URL is the default catalog source, with a 1.2-second
  timeout and same-origin GitHub Pages catalogs as the offline/outage fallback.
  `window.SCHMETTERLINGE_LANGUAGE_BASE_URL` can override the URL if needed.
  Passing an empty string disables the CDN.
- No paid Cloudflare R2/KV/D1/Workers, translation APIs or additional
  Supabase tables are required.

## External hosting state

The GitHub integration was reauthorized and the Cloudflare Pages project
`schmetterlinge-language-packs` was created. The first deployment succeeded
on 11 October 2026, with 12 static files uploaded (11 JSON catalogs and
`manifest.json`). No paid services or Functions were enabled.

## Verification

- `node scripts/validate-i18n.mjs`
- `npx playwright test tests/e2e/i18n.spec.mjs`
- Existing CI `tests/validate.mjs` checks the 320-key locale inventory,
matching keys, and static HTML text coverage.
- Mobile and Arabic-RTL visual check before calling it fully accepted.
- Expand translation coverage of legacy dynamic sentences incrementally.
- Keep source attribution, result evidence and sport-data semantics intact.
