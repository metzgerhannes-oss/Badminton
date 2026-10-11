# v83 – LIVE vereinfacht

## Produktregel
**Eine Aufgabe zur Zeit.** In LIVE gibt es zwei 46-px-Touchziele: **Meine Spiele** (Standard) und **Alle Spiele**. Die beiden Bereiche werden nicht länger untereinander dargestellt. Der normale Reiter **Turniere** bleibt für gespeicherte Veranstaltungen und bisherige Spieler-Live-Fallbacks erhalten; der große, doppelte turnierweite Bereich wird dort verborgen.

## Vereinfachungen
- Persönliche Spiele starten sofort. Wechselt man in LIVE, sieht man zuerst das aktuell betrachtete Spielerprofil und dessen Badhub-Matches.
- „Alle Spiele“ lädt nur nach ausdrücklichem Öffnen die bereits belegten Turniermatches aus Supabase. Das bisher parallel aktive Spieler-Polling pausiert.
- Pro ausgewähltem Turnier **ein** validierter Original-DBV-Link statt einer Liste mehrerer ähnlicher Links und zusätzlicher Badhub-Links.
- Bei null importierten Begegnungen: eine klare Erklärung und die Originalquelle unmittelbar erreichbar. Status- und Feldfilter sind solange verborgen.
- Bestehende Quellenhinweise und fachliche Grenzen bleiben: keine unbestätigten Begegnungen, keine Live-Sätze aus alten Snapshots, keine neuen API-Kosten.
- Beim erneuten Öffnen von LIVE startet der Fokus bewusst wieder mit „Meine Spiele“. Der normale Reiter Turniere zeigt weiterhin die Favoriten.

## Abnahme
`tests/matchday-simplicity.mjs` prüft zwei exklusive Zustände, URL-Provenienz, keine parallelen Abfragen und Routen-Reset. Playwright prüft 320px, sichtbare Karten, Statusfilter sowie die zurücksetzende Navigation.
