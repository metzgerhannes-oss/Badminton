# v84: Echte LIVE-Daten ohne neue Anbieter-API

## Befund
Das produktive Modell kennt bereits `player_live_watches`, den begrenzten `private.refresh_live_radar`-Cron-Job (maximal sechs beobachtete DBV-Spieler pro Minute) und `player_live_snapshots`. Die Quelle ist die ohne Benutzer-Login öffentlich gemeldete **Badhub-Spieler-Liveansicht**. Für diesen Pilot wird **kein** neuer Datenanbieter abgefragt, kein Cloudflare-Konto und kein zusätzlicher Secret-Key benötigt. Der mit RLS geschützte bestehende Supabase-Projektpfad bleibt unverändert.

## Realisierte Brückenlösung
**LIVE → Alle Spiele → Unsere Spieler**: Die App zeigt bis zu sechs eigene/gefolgte öffentliche DBV-Spieler in einer kompakten Liste (auf kleinen iPhones zwei Spalten). Für jeden Spieler werden unabhängig und quellengetreu Aufruf/Spiel, Warterang, der nächste Gegner, veröffentlichte Sätze und der Abgleichzeitpunkt angezeigt. Die Reihenfolge bevorzugt das gerade ausgewählte Profil, danach eigene und gefolgte Spieler. Der Button **„Meine Spiele ansehen“** wechselt zur vorhandenen Einzelansicht.

- Nur bei geöffnetem Tab und aktiver Ansicht abrufen; im Hintergrund keine POST/GET-Abfragen.
- Maximal sechs DBV-IDs pro Aufruf, identische IDs werden eliminiert.
- Höchstens ein Beobachtungs-Ping alle 75 Sekunden pro DBV-ID, ansonsten gemeinsamer 30-Sekunden-Cache-Read; DB-Cron verarbeitet neue Ping-Anfragen unabhängig.
- Der bestehende SQL-Trigger begrenzt weitere Zuwächse und verhindert anonyme Massencrawls.
- Wenn der Quellabgleich älter als **120 Sekunden** oder die signierte Quellenzuordnung ungültig ist, **keine** alten Scores als live.
- Bei einem leeren Matchfeed keine erfundenen Ansetzungen. Spieler-Matches fließen **nicht** in `matches`/`match_games` oder offizielle Turnier-W/L-Zahlen; ungeprüfte IDs/Teams/Verschiedenheit von Events werden nie vereinigt.
- Die lokal auf dem Gerät gespeicherten Follow- und Profilnamen werden nicht in die Datenbank geschrieben. Supabase erhält ausschließlich öffentliche DBV-IDs, die serverseitig bereits verifiziert sein müssen.

## Getrennt bleibender Original-Spielplan
Unter den Spielerkacheln steht die **offizielle Turnierübersicht** aus ausschließlich verifiziert importierten DBV-Matches. Diese ist noch nicht vollständig automatisiert: bis zur Freigabe eines zuverlässigen Datenfeeds führt ein einzelner geprüfter DBV-Link direkt zu einem echten Turnierspielplan.

## Folgende drei Wege für wirklich *alle* Turniermatches
1. **DBV/Tournamentsoftware**: offizieller, dokumentierter Read-only Event-Feed bzw. Veranstalter-Export. Bevorzugt für vollständigen Plan. Nach dokumentierter Nutzung ist ein zeitbegrenzter Edge-Cron mit 1–2-Minuten-Cache sinnvoll.
2. **Badhub-Abonnement**: mit Betreiber abgestimmter vereinsspezifischer Event-/Spielerfeed mit Änderungszeit, Match-ID, Status und Score. Der bereits aktive Spielerfeed kann nach Quellenfreigabe serverseitig ingestiert werden. Für das jetzige Implementat wird die bestehende öffentliche Einzelansicht nur als individueller Live-Nachweis verwendet.
3. **Veranstalter-Pilot**: vom Organisator aktiv bereitgestellte exportierte Ergebnisdatei als einmaliger Import/regelmäßiger freigegebener Upload, statt selbstähnliche Turnierseiten blind abzurufen. Quellencheck, Duplikatschlüssel und Satzlogik beim Import zwingend.

Nicht geeignet: Open APIs anderer Turnierprodukte wie Tournament Suite, tournament.app oder FairGame sind *nicht* die DBV/Tournamentsoftware-API. Unkontrolliertes Scraping ist keine belastbare kostenlose Verfügbarkeitsgarantie und kann IP-Sperren hervorrufen.

## Abnahmebedingungen
- CI: `tests/followed-live.mjs`, `tests/e2e/matchday-live-tab.spec.mjs`.
- Realer Turniertag: Badhub-Original pro Spieler gegen Anzeige vergleichen (Gegner/Feld/Uhrzeit/Satz, 2 Spieler gleichzeitig, stale, W.O.). Am Ende keine falschen Gewinner/Ergebnisse und keine Doppelzählungen.
- Quelle/Rechte: Nutzung und Cache-Intervall gegen Anbieterbedingungen gegenprüfen; keine ungeprüfte Massenspiegelung.
