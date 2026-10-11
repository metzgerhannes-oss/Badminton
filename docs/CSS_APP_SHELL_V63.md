# v63 – CSS und Frontend: getrennte App-Shell

## Ziel

Die wiederholten Gestaltungsregeln der früheren Fünf- und Sechs-Tab-Navigation sollten nicht länger die heute verbindliche Navigation beeinflussen. Die produktive Führung bleibt bei **Home, Turniere, Spieler, Berichte**; die Einstellungen bleiben im Kopfbereich. Ein Klick auf Home oder das Logo führt weiter zum eigenen lokalen Profil.

## Umsetzung

- Neue Stylesheet-Datei `app-shell.css` wird **nach** `styles.css` und `design-v2.css` eingebunden.
- Die verbindliche Header- und Navigationsgestaltung aus dem bisherigen v3-Block wurde ohne Änderung ihrer Maße und Farben in das eigene Modul verschoben.
- Die veralteten Angaben `16.666%`, `20%` und `33.3333%` für die Tab-Breite wurden aus den historischen Layoutschichten entfernt. Die vier Tabs werden verbindlich mit `25%` in der App-Shell definiert.
- Die Regeln für schmale Geräte (bis 410 px und bis 350 px) bleiben in der aktuellen Shell erhalten. Das freigegebene Vereinslogo samt Schutz vor Zuschneiden oder Maskieren bleibt unverändert.
- Der Service-Worker speichert `app-shell.css` offline mit Cache-Version v63.
- Node-Gates sichern Stylesheet-Reihenfolge, Navigation, Logo, Cache; Playwright prüft die Bedienbarkeit bei 320, 375, 390 und 768 px in Chromium und WebKit.

## Abgrenzung

Keine Änderung an lokalen Spielerdaten, Supabase-Schema, Matchstatistik oder Quellenbewertung. Noch bestehende ältere Farb- und Komponentenregeln in `styles.css` und `design-v2.css` werden später nur mit visueller Vergleichssicherung bereinigt; keine riskante Komplettumschreibung in dieser Version. Reale iPhone- und VoiceOver-Abnahme bleibt separat offen.
