# Historie beim Folgen / eigene DBV-Profile – On-demand-Import

Stand 10.10.2026; v49 ändert den Import-Auslöser. Ziel: Historienabfragen erst beim Öffnen der betreffenden Historie, nicht beim bloßen Folgen, Einrichten oder App-Start.

## Ablauf

1. **Folgen, neue eigene Profile und Einladungen bleiben lokal.** Erst das Öffnen der **Historie** für einen eigenen/gefolgten Spieler überträgt dessen öffentliche **DBV-ID** (z. B. `05-061350`) zur Prüfung an Supabase. Die Followerliste wird nicht als Liste übertragen. Bereits vorhandene serverseitige Aufträge bleiben unberührt.
2. Die App fragt Supabase `player_history_imports` ab. Liegt noch kein Auftrag vor, wird ein identitätsvalidierter **INSERT-only**-Auftrag angelegt. Durch `dbv_id` als Primärschlüssel und eine Sperre gibt es maximal einen gemeinsamen Auftrag pro DBV-Spieler. Folgen mehrere Familien derselben Person, verwenden sie den vorhandenen Status und die Ergebnisse.
3. `pg_cron` führt alle **15 Minuten** den serverseitigen, auf maximal fünf Spieler pro Lauf begrenzten Worker `private.process_player_history_imports(5)` aus. Er verwendet eine **redaktionell freigegebene Quellliste** aus unserem öffentlichen GitHub-Projekt, lädt nur bereits geprüfte Metadaten-Snapshots, validiert Identität und Summen und speichert diese in `player_history_overviews`. Es gibt **keinen Crawler über alle Spieler**, keine Paywall-Umgehung und kein unkontrolliertes Scraping.
4. Für Sarah Storz (`05-061350`) existiert der geprüfte Badhub-Stand: **678 erfasste Spiele, 388 Siege, 290 Niederlagen**. Der Worker hat diese Daten tatsächlich nach Supabase übertragen und als `partial` gekennzeichnet. Die App zeigt sie als **externe Karriereübersicht**, nicht als offizielle DBV-Einzelmatches.
5. Für andere Spieler ohne vorhandenen zulässigen strukturierten historischen Datensatz (z. B. Philipp) gibt es `awaiting_source`: **„Einzelmatch-Quelle noch nicht verfügbar“**. Es werden keine Ergebnisse erfunden. Der Worker prüft solche Fälle nach sieben Tagen wieder.
6. Wenn ein neuer redaktionell geprüfter Datensatz in `data/player-history/index.json` ergänzt wurde, wird er spätestens beim nächsten planmäßigen Quellenabgleich für bereits angefragte Spieler übernommen. Offene Fehler werden nach frühestens einer Stunde erneut versucht.

## Datenzugriff, Sicherheit und Kosten

- Die `public.player_history_imports`-Tabelle hat RLS. Anonyme Browser dürfen **nur die Spalte `dbv_id` INSERTen** und öffentliche Statusinformationen lesen, nicht Status/Datum ändern oder löschen.
- Ein Importauftrag ist nur für einen bereits in der Datenbank verifizierten DBV-Spieler gültig; die ID muss dem Muster `NN-NNNNNN` entsprechen. `public.player_history_overviews` ist ausschließlich öffentlich lesbar, vom Worker befüllt.
- Private Triggerfunktion `private.guard_history_import_insert()` begrenzt neue einzigartige Aufträge auf **60 pro 24 Stunden** (globale Grenze), serialisiert über einen Advisory Lock und ignoriert Duplikate. Die Sperre verhindert eine beliebig teure Massenabfrage über 9.246 Spieler. Es ist eine globale Schutzgrenze; bei hoher Nutzung wäre ein gesondertes Auth-/Rate-Limit je Gerät/IP sinnvoll.
- Die Tabellen enthalten weder Follower-Identitäten noch private Freundeslisten. Es ist ein **globaler Importcache**, keine geräteübergreifende Freundes-Synchronisierung.
- Das GitHub-Quellarchiv bleibt Fallback, falls Supabase nicht erreichbar ist. Der Worker nutzt `extensions.http_get` wie die vorhandene Ranglistenaktualisierung, ohne Service-Role-Schlüssel im Browser.
- Vollständig offizielle Matchzeilen benötigen weiterhin einen **belastbaren, zulässigen Ergebniszugang** mit Match-ID, Datum, Disziplin, Teams, Gegenseite, Sieger, Walkover-Prüfung und Originalquelle. Ein solcher generischer Adapter existiert aktuell nicht. Bis dahin bleibt `player_match_observations` korrekt bei null Einzelmatches. **Status `partial` bedeutet nie „Matchimport abgeschlossen“.**

## Zustände

| Status | Bedeutung |
|---|---|
| `queued` | Auftrag erstellt; wartet auf nächsten serverseitigen Lauf |
| `checking` | Quellen werden kontrolliert |
| `partial` | Externer, geprüfter aggregierter Karriereüberblick importiert; Matchdetails fehlen möglicherweise |
| `awaiting_source` | Keine zugelassene strukturierte Detailquelle verfügbar; spätere Nachprüfung |
| `error` | Quellenprüfung derzeit gestört; erneuter automatischer Versuch |

Die Statusanzeige erscheint auf **Home** und **Historie** des ausgewählten eigenen/folgenden Spielers. Freunde, die nur lokal gespeichert sind, werden dabei nicht öffentlich als „Follower“ veröffentlicht.

## Technische Bestandteile

- `database/history-on-demand.sql`: zwei RLS-gesicherte Tabellen, Einfüge-/Drosseltrigger, privater Quellen-Worker und automatischer 15-Minuten-Job.
- `scripts/history-demand.mjs`: Eingabe- und REST-Validierung mit anonymem Publishable Key.
- `history-demand.js`: Statusabfrage und Abgleich erst bei geöffneter Historie; bei Profilwechsel innerhalb dieser Ansicht nur die gewählte DBV-ID. Externer Import maximal einmal je DBV-ID und 15 Minuten innerhalb einer Sitzung.
- `welcome.js`: Die Ersteinrichtung bleibt rein lokal und erzeugt keinen Historienauftrag.
- `career-history.js`: Supabase-Überblick bevorzugt, geprüfte GitHub-JSON-Dateien als Fallback.
- `tests/history-demand.mjs`: DBV-ID-Validierung, Ressourcengrenzen und bedarfsgesteuerter Historienauslöser.

## Live-Verifikation (10.10.2026)

- Sarah `05-061350`: Status `partial`, externe Karriereübersicht zentral vorhanden; Quelle Badhub 678 / 388, 0 einzeln importierte DBV-Matches.
- Philipp `05-070879`: Status `awaiting_source`; keine vorgetäuschte historische Matchliste.
- Supabase `anon`: `SELECT` Status erlaubt; `INSERT(dbv_id)` erlaubt; `UPDATE`, `DELETE`, Inserts in `player_history_overviews` verweigert.
- Supabase Security Advisors: **keine Befunde**.
- `cron.job`: `badminton-history-demand-worker` mit aktivem Zeitplan `*/15 * * * *`.
