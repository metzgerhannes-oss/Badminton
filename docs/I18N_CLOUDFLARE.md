# Schmetterlinge: Mehrsprachigkeit und Cloudflare Free

## Scope
Eleven language packs: de, en, fr, uk, ru, zh-Hans, tr, ar, it, es, pl.
The v2 baseline contains at least 342 shared translation keys per language, preserving the existing v117 translations and incorporating the expansion from PR #92. Five languages already have up to 387 keys. This remains **partial coverage**: new privacy, calendar, team, onboarding, owner and dynamic strings still need translations, with no mandatory external translation service. Untranslated text falls back to German.

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
- Mobile and Arabic-RTL visual check before calling it fully accepted.
- Expand translation coverage of legacy dynamic sentences incrementally.
- Keep source attribution, result evidence and sport-data semantics intact.

## Integration status

This is a draft integration of the 11 catalogs only, not the release-complete translation. At least 147 current static UI strings were missing from the older PR #92 reference (including privacy, team, DBV calendar and owner activation); the language-key catalogs are not proof of full application coverage. Before resolving #176 all new static/dynamic strings must be reviewed, translated into all 11 languages, RTL tested and sensitive legal text editorially validated. The v2 runtime rejects outdated external v1 catalogs.
