# Issue #298 · Paket B — Quellen- und Statusfreigabe

Stand: 19.10.2026 (Europe/Berlin). **Kein neuer Live-Provider und keine produktive Datenabfrage in diesem Paket.**

## Nachweis und Grenzen

| Bestand / Quelle | Tatsächlich belegbar | Nicht belegbar |
| --- | --- | --- |
| `public.league_fixtures` aus `database/team-league-public-directory-v95.sql` | `scheduled`, `finished`, `postponed`, `cancelled`, `forfeit`, `unknown`; Spieltag, Quelle, individueller `source_checked_at`, ggf. zwei vollständige Scores | `running`, Feld, laufende Sätze oder Zwischenstand |
| `private.sync_nuliga_club` aus `database/nuliga-bwbv-league-scraper-v96.sql` | Öffentliche Mannschaftsansetzungen und bestätigte abgeschlossene Spielstände | Kontinuierliche Spielstandsmeldungen |
| `database/nuliga-daily-refresh-jobs-v96.sql` | Drei bestehende, gestaffelte tägliche Imports | Sekundengenaue oder minutengenaue Aktualität |
| `docs/LIVE_DATENZUGANG_STRATEGIE.md` | nuLiga REST-Dokumentation vorhanden; dokumentierter Aufruf mit HTTP 401 ohne Token/IP-Freigabe | Autorisierter automatischer REST-Livezugriff |
| Badhub `player_live_snapshots` / `scripts/live-radar.mjs` | Spielerbezogene, validierte Badhub-Meldungen mit exakter DBV-ID und `checked_at` höchstens 120 Sekunden alt | Verallgemeinerte Mannschafts-Livebehauptungen |

Ein offizieller öffentlicher Link oder eine angesetzte Uhrzeit ist **kein** Beleg, dass ein Match gerade läuft. Ein täglicher `source_checked_at` ist ein Quellenzeitpunkt, keine Garantie für einen Live-Status.

## Verbindliche Darstellung

- **Heute angesetzt** nur bei einem datierten, zur lokal gefolgten Mannschaft gehörenden und auf einer zugelassenen nuLiga-URL belegten `scheduled`-Spiel.
- **Ergebnis veröffentlicht** nur bei `finished` oder `forfeit` **und** vollständigem, plausibel bestätigtem `home_score` / `away_score`; sonst **Ergebnis noch nicht belegt**.
- **Verlegt** / **Abgesagt** nur bei explizitem Quellstatus. `unknown` wird nicht als Live- oder Ansetzungsbeweis ausgegeben.
- **Spielt gerade**, **Spiel aufgerufen** oder **Turniertag gemeldet** ausschließlich für einen validierten Badhub-Spielersnapshot mit `checked_at` höchstens 120 Sekunden alt, passender DBV-ID und vorhandenem Quellereignis. Bei Ablauf keine alte Live-Aussage weiter anzeigen.
- **Mannschaftsspiel läuft** bleibt deaktiviert. Weder Datum, Spielbeginn, Zwischen-Score in `scheduled` noch fehlender Quellzeitpunkt dürfen diesen Status erzeugen.
- **Vorgemerkt** ist keine Teilnahmebestätigung. Nur auf dem Gerät vorhandene Follows/Bookmarks berücksichtigen.
- Auf jeder Karte Quelle, Quelllink und **individuellen** Abgleichzeitpunkt anzeigen; ohne Beleg keinen Zeitpunkt erfinden.

## Datenschutz, Kosten und Betriebsgrenzen

Paket B verwendet ausschließlich SQL-/Code-/Dokumentationsaudit und synthetische Offline-Tests. Keine Supabase-Produktivabfrage, kein Scraping, keine Tokenumgehung, keine neuen Cronjobs, kein Intervallpolling, kein Profileingriff, keine neue Datenbanktabelle. In Paket C höchstens 6 gefolgte Badhub-Spieler, 12 lokal gefolgte Teams und 96 Mannschaftsbegegnungen; nur bedarfsgesteuerte wenige öffentliche Lesezugriffe bei Ansicht/ausdrücklichem Refresh und vorhandene Cache-Mechanismen. Gewöhnliche CI und Playwright müssen weiterhin produktives Supabase vollständig blockieren.

## Gate B und Folgeschritt

**Entscheidung: eingeschränkte Quellenfreigabe.** Der vorhandene Datenbestand darf in Paket C nur für belegte Ansetzungen, Absagen/Verlegungen, bestätigte Endergebnisse und tatsächlich frische Badhub-Spielerereignisse verwendet werden. Ein Mannschafts-Liveticker ist **nicht** freigegeben. Ein künftiger echter Live-Pilot benötigt separat autorisierten Providerzugang, nachvollziehbaren Match-Identifier, Status, Timestamp, Aktualisierungsintervall, Nutzungsrechte und explizite Freigabe.

Paket C beginnt erst nach grünem Paket-B-PR, Merge und Main/Pages-QA auf exakt demselben Merge-SHA. Die UI benötigt eigene Browser-/Screenshot-/Echtgeräteabnahme.
