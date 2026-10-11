# Schmetterlinge – Sprachpakete v77 (11 Sprachen)

## Status und Umfang
Die App unterstützt mit der neuen i18n-Infrastruktur die Sprachcodes **de, en, fr, uk, ru, zh-Hans, tr, ar, it, es, pl**. Jedes Paket enthält 87 manuell vorbereitete UI-Begriffe (Version 1). **Noch keine vollständige Übersetzung der gesamten App:** lange Hilfetexte und dynamische Statusmeldungen bleiben zunächst deutsch. Kein kostenpflichtiger Übersetzungsdienst und kein Sprachpaket-API-Token werden benötigt.

## Technik
* `i18n.js` lädt bei Bedarf ein gleichnamiges JSON aus `/locales`, behandelt dynamisch eingefügte UI durch einen MutationObserver und bewahrt Originaltexte für einen verlustfreien Sprachwechsel auf.
* Das lokale Paket bleibt Fallback, wenn der optionale Cloudflare-Host nicht erreichbar ist.
* Sprachwahl unter Einstellungen und im Willkommens-/Einrichtungsablauf. Ein gemeinsamer, vom Familienprofil getrennter `localStorage`-Schlüssel `schmetterlinge.uiLanguage` hält `auto` bzw. den gewählten Sprachcode.
* Automatisch folgt `navigator.languages[0]`; `ar` aktiviert RTL. Offizielle Namen, Spielerkennungen und Quellwerte dürfen nicht verändert werden.
* Der Service Worker v77 precacht alle elf kleinen JSON-Pakete samt `i18n.js`, damit die zuletzt installierte PWA offline umschalten kann.
* Übersetzungen dürfen weder Spielstand, Quellenbelege, DBV-ID, Matchlogik noch die lokale Backup-Struktur verändern.

## Kostenloses Cloudflare Pages
Optionale Konfiguration nach dem Veröffentlichen eines ausschließlich statischen Pages-Projekts mit Git-Verbindung:
- Repository: `metzgerhannes-oss/Badminton`
- Produktionsbranch: `main`
- Root Directory: `/locales` oder `locales` (abhängig von der Pages-UI)
- Build command: leer, Output directory: `.`
- Inhalt: elf JSON-Dateien, keine Pages Functions, kein R2/KV/D1.
- Erst **nach erfolgreichem CDN-Deployment und Testabruf** darf im Frontend `window.SCHMETTERLINGE_LANGUAGE_BASE_URL` auf `https://<pages-projekt>.pages.dev` gesetzt werden. Bei Fehlern greift der same-origin Fallback.
- GitHub Pages kann zunächst allein ausliefern; kein Cloudflare-Zwang beim Laden.
- Nur Pages Free verwenden. Bei erschöpften Build-Kontingenten abbrechen, niemals kostenpflichtig hochstufen.

## Tests
`npx playwright test tests/e2e/i18n.spec.mjs` prüft Persistenz, Türkisch/Polnisch, Arabisch RTL, Rückwechsel zu Deutsch.
Bei jedem neuen Sprachpaket: Schlüsselgleichheit, JSON-Parse, HTML-Escaping, RTL-Layout auf kleinen iPhones und Übersetzungsqualität prüfen.
