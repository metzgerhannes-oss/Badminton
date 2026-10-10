# v44 – Importfortschritt entspricht tatsächlichen Einzelbelegen

Stand: 10.10.2026; P0 Produktdaten-Qualität.

## Identifizierter Fehler
`player_external_match_imports.cursor_offset` ist lediglich die zuletzt verarbeitete Position im serverseitigen Quellenimport. Der alte Text nutzte `Math.max(loadedCount, cursor_offset)` als Zahl **übernommener Matches**. Wenn die Position 240, aber im REST-Read nur 42 Quellkarten enthalten sind, wurde fälschlich `240 von 608 importiert` behauptet.

## Korrektur
- Die abrufbaren Quellkarten sind ausschließlich die nach dem GET tatsächlich gelesenen Zeilen. Der Importcursor wird separat als verarbeitet, nicht als gespeichert bezeichnet.
- `verified_count` ist eine serverseitige Anzahl der als importierbar erkannten Quellkarten, **nicht** der offiziellen Karriere-Matches und keine Garantie der erfolgreichen Speicherung.
- Ablehnungen, Importfehler und Zeitpunkt des letzten dokumentierten Importversuchs werden eindeutig getrennt. Nur `computeExternalStats` bestimmt, welche abrufbaren Einzelbelege als Sieg/Niederlage gelten.
- Nach mindestens 5 Minuten Inaktivität erneuert die zurückgekehrte App die öffentliche Read-only-Abfrage von Home/Historie auf dem gerade angezeigten Profil. Kein automatischer neuer Quellcrawl, keine importierenden Browseranfragen, kein dauerndes Polling.
- PWA Cache v44, Fach- und mobile Regression. Keine DB-Migration, Berechtigungsänderung oder Änderung persönlicher Profile.

## Grenzen
Der bestehende Serverjob bearbeitet höchstens einen Quellen-Spieler pro 30 Minuten und ist global begrenzt. Auch korrekt gemeldete Zeilen sind nur ein **Teilbestand**; vollständige historisch-lizenzierte DBV/Badhub-Matchdaten und echte iPhone-Praxisabnahme bleiben #17/#28 offen. Direkter Zugriff auf das produktive Badminton-Supabase-Projekt war in dieser Sitzung nicht vorhanden, deshalb wird keine neue tatsächliche DB-Zeilenzahl behauptet.
