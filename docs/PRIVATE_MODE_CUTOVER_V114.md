# Schmetterlinge – Umstellung auf privaten Spielerbereich (v114)

13.10.2026 · ausschließlich Supabase `yadexibmjmnjfmfabrug` und GitHub `metzgerhannes-oss/Badminton`.

## Grundsatz und derzeitiger Funktionsumfang

Der Quellcode der kostenlosen PWA bleibt öffentlich und installierbar. Der allgemeine DBV-Turnierkalender, nicht personenbezogene Vereins-/Mannschaftsinformationen, lokale Profilwahl, Favoriten, Spond-Termine und Offline-Backup bleiben ohne Anmeldung nutzbar.

**Persönliche Suchergebnisse, Namen, Ranglisten, belegte Matches, Spielererwähnungen und gemeinsam veröffentlichte Teilnahmehinweise werden dagegen vorerst gesperrt**, bis eine serverseitige, gezielt verifizierbare Einladung sie zugänglich macht. Das ist eine **bewusste temporäre Einschränkung**, keine vermeintlich bereits fertige private Spieleransicht. Ein Login oder eine öffentliche DBV-ID alleine darf niemals die Freigabe ersetzen.

## Sicherung vor dem Cutover

Vor der Änderung wurden fünf namentliche GitHub-Quellen mit einer DDL-Migration `private_source_snapshot_v113` in `private_content.source_snapshots` gesichert: kuratierte Historie, Rankingausschnitt, freigegebene Artikelzuordnungen, Karriereindex und einzelne Karriereübersicht. Insgesamt ca. 52 kB JSON, fünf Quellobjekte. Schema **nicht** in der Supabase Data API exponiert; `anon` und `authenticated` haben keine SELECT-Rechte; RLS aktiv. Die 9.246 Einträge der bisherigen Spielerbibliothek wurden nicht noch einmal dupliziert: Die entsprechenden Datensätze sind bereits in der bestehenden `public.players`-Tabelle vorhanden.

Dies ist eine **private Quellsicherung**, keine neue Rechtsgrundlage und keine aufbewahrungsrechtliche Freigabe. Inhalte nicht in CI-Logs, Issues oder öffentliche Test-Branches kopieren.

## GitHub und GitHub Pages

- `.github/workflows/ranking.yml` und `.github/workflows/report-discovery.yml` werden bis zur Freigabe eines privaten Datenpfads ausgesetzt. Keine wöchentliche öffentliche 9.246-Personen-Spielerliste und keine neuen personenbezogenen Review-Issues/Branches.
- `data/history.json`, `data/ranking.json`, `data/report-articles.json`, `data/player-history/index.json`, `data/player-library/*.json` sind öffentliche, **leere Privatmodus-Stubs** mit unverändertem technischen Grundformat.
- Die einzelne personenbezogene `data/player-history/05-061350.json` wird aus dem aktuellen Git-Baum gelöscht; Service Worker listet sie nicht mehr als PWA-Asset. Pages-Stempel aktualisiert den Cache über neuen Commit, alte Service-Worker-Caches werden beim Aktivieren verworfen.
- Das CI-Testgate `tests/private-publication-gate.mjs` verhindert, dass die unmittelbar betroffenen Daten oder beiden automatischen Veröffentlichungsjobs versehentlich wieder aktiviert werden.
- **Einschränkung:** In Git-Historie, älteren Pages-Deployments, Browser-Caches, Forks, Suchmaschinen-Caches, geöffneten GitHub-Issues und historischen Testtexten können weiterhin personenbezogene Daten stehen. Ein normaler Commit ist **keine historische Löschung**. Bei Bedarf ist ein separater, geprüft durchgeführter Git-History- und GitHub-Pages-/Actions-Artefakt-Cleanup nötig; niemals unbeaufsichtigt History-Rewrite erzwingen.

## Supabase – Cutover-Reihenfolge

1. Statische GitHub-Änderungen erst nach erfolgreichen CI- und mobilen Browser-Tests nach `main` mergen. GitHub Pages erfolgreich deployen und personenbezogene statische Pfade kontrollieren.
2. **Unmittelbar danach** die Migration aus `database/private_player_read_cutover_v114.sql` auf dem korrekten Badminton-Projekt anwenden. Sie entfernt `SELECT` von `anon`/`authenticated`/ `PUBLIC` auf 14 personenbezogenen Tabellen und der personalisierten SQL-View, entfernt die anonymen SELECT-Policies und die ehemaligen Spaltenleserechte von `player_history_imports`. Der anonyme historische Importanforderer verliert außerdem EXECUTE/INSERT. **Keine Datensätze werden gelöscht**; private Services können weiter auf vorhandene Daten zugreifen.
3. Live-Abnahme: `has_table_privilege` und `has_column_privilege` für beide Browserrollen auf alle betroffenen Objekte **false**; `dbv_calendar_entries` für `anon` weiter SELECT true; 29/29 public-Tabellen weiter mit RLS; 0 Advisor-Befunde.
4. Negative REST-Abfrage mit öffentlichem Schlüssel gegen `players`, `player_external_match_facts`, `shared_tournament_hints` muss 401/403 oder permission denied ergeben, nicht `200` mit personenbezogenen Inhalten. GitHub Pages statische Datenpfade dürfen keine benannten Profile mehr liefern.
5. Badhub-/Quellenimporte, Cron und Drittrechte getrennt auf Notwendigkeit, Retention und Quoten prüfen. Ein Stop öffentlicher API-Aufrufe löscht bisherige Zentraldaten **nicht**.

## Einladungsberechtigung: separater Schritt nach privatem Cutover

- Technisch einmalige, kryptografisch zufällige Einladungen mit **mindestens 256 Bit**, Token nur im URL-Fragment, serverseitig nur Hash, kurze Gültigkeit, Widerruf und knappe Quoten; kein URL-/Tokenlogging.
- Server prüft **bei jedem persönlichen Abruf** explizite Mitgliedschaft/Einladungsumfang; `authenticated` allein reicht nicht, da Supabase Anonymous Auth die gleiche Datenbankrolle verwendet. Kein `SELECT`-Grant auf ganze Spieler-Tabellen.
- Berechtigte Ersteller müssen selbst über einen unabhängig verifizierten Verwaltungsnachweis verfügen; ein selbst eingegebenes DBV-Profil, Follow, anonymes Konto oder weitergeleiteter Link begründet **keine** Sorgeberechtigung. Bis diese Prüfung implementiert ist, **keine private Personensuche für beliebige Besucher freischalten**.
- Kein manuelles Anlegen eines Kontos pro Besucher. Einladungsempfänger können das minimal erforderliche Profil via kontrolliertem serverseitigen RPC lesen; bestehende private Einzelturnier-Einladungen (#139) sind enger und erteilen gerade **kein** Leserecht für personenbezogene Matcharchive.
- Personenrechte, tatsächlicher Betreiberkontakt, Quellenrechte, Betroffenenrechte und Löschfristen (#53/#56) bleiben trotz geschlossenem Kreis erforderlich.

## Rollback

Ein GitHub-Commit-Rollback **allein** reicht nicht: GitHub-Caches/Actions und Supabase-Grants müssen stets gemeinsam bewertet werden. Niemals bei Bedienungsproblemen pauschal `GRANT SELECT ON ALL TABLES TO anon` ausführen. Fehler zunächst mit read-only Prüfungen isolieren; eine Wiederöffnung einzelner personenbezogener Daten erfordert separate ausdrückliche Datenschutzfreigabe.
