# P0 #417 · Nichtöffentlicher, synchroner Supabase-Zugriffsschutz (STAGED)

Stand: 27.10.2026, 17:06 Europe/Berlin. **Nicht produktiv aktiviert. Kein Main-Merge, kein Pages-Deployment, kein zweiter Code-PR.** Dieser Branch ist in einem weiterhin öffentlichen GitHub-Repository sichtbar und stellt **keine private Client-Distribution** dar.

## Read-only Produktionsinventur (Projekt yadexibmjmnjfmfabrug, Backup-Verbindung)

- Genau 10 RLS-Tabellen haben aktuell `anon SELECT`, `authenticated SELECT` und jeweils eine `USING (true)`-Policy: `clubs`, `dbv_calendar_entries`, `events`, `league_clubs`, `league_fixtures`, `league_table_rows`, `league_teams`, `ranking_weeks`, `report_sources`, `tournaments`. RLS ist eingeschaltet, aber diese SELECT-Policies erlauben anonyme Reads.
- `public.search_dbv_player_identity(text,text,text,text)` ist `SECURITY DEFINER`, besitzt `anon EXECUTE` und hat bisher keinen Familienmitglieds-Guard. Sie kann bis zu 12 Identitäten zurückgeben. Der Guard muss **vor** dem Quota-UPSERT greifen.
- Supabase `signInAnonymously()` nutzt die PostgreSQL-Rolle `authenticated`; nur `REVOKE FROM anon` würde **nicht** reichen. `app_access_is_member()` prüft bestehende nicht widerrufene Familienmitgliedschaft/Owner serverseitig.
- Die Auth-/Einladungs-RPCs bleiben unangetastet. `private_tournament_invite_read(p_token)` ist ein **separater, tokenbegrenzter Capability-Pfad**, nicht die allgemeine Familienmitgliedschaft. `limit_user_tournament_links_v87` ist eine Triggerfunktion; keine Freigabe auf zusätzliche Tabellen daraus ableiten.
- `public.players` und `ranking_entries` haben kein direktes allgemeines `anon/authenticated SELECT`; die Mitgliedssuche erfolgt über die gezielte RPC.
- Die sechs `data/player-library/U*.json` enthalten aktuell jeweils null Spieler, `data/ranking.json` und `data/history.json` sind private/leer. `data/dbv-calendar.json` enthält 281 statische Turniertermine. **RLS schützt keine Dateien in einem öffentlichen GitHub-Repository oder auf GitHub Pages.** Weitere statische und historische Git-Objekte sind separat auf Personenbezug zu prüfen.
- Repository `PUBLIC`, `has_pages=true`. Vorherige Pages-Testwebsite kann weiter öffentlich erreichbar sein; diese Codeänderung versteckt sie nicht.

## Vorbereitete, aber nicht ausgerollte Änderungen

1. `scripts/supabase-read.mjs`: sämtliche PostgREST-Tabellen-GETs benötigen `badmintonAppAccess.allowed===true` und einen aktuellen Member-JWT. Nicht eingeladene Auth-Anonym-Sitzungen und eingeschränkte Spielerlinks scheitern lokal ohne Netzwerk.
2. `scripts/targeted-player-search.mjs`, `friend-search.js` und `live.js`: keine anonymen Supabase-Sportdatenprobes, JWT nur bei echter Familienmitgliedschaft. Bestehende Auth-/Einladungs-RPCs und getrennte Spielerlink-Scopes bleiben erhalten.
3. `dbv-calendar.js`, `teams.js`, `library.js`: Initialisierung darf vor Zugang einen statischen/fail-closed Zustand zeigen; nach verifiziertem Familien-Grant werden die benötigten privaten Quellen neu geladen.
4. `database/p0-417-staged-member-rls-cutover.sql`: transaktionaler Drift-Preflight, Entfernen genau der 10 `USING(true)`-Policies, `REVOKE SELECT FROM PUBLIC,anon`, pro Tabelle `SELECT TO authenticated USING ((SELECT public.app_access_is_member()))`; RPC-Guard vor Quota, `REVOKE EXECUTE FROM PUBLIC,anon`. **Absichtlich nicht** in `supabase/migrations`, keine automatische Anwendung.
5. `database/p0-417-staged-rollback-RESTORES-PUBLIC-READ.sql`: Notfall-Rückweg. **WARNUNG:** Stellt die bisherige öffentliche Lesbarkeit wieder her; nur im koordinierten Ausnahmefall.
6. Synthetische Tests: Gast → 0 REST/RPC-Netzwerkaufrufe, gültiges Mitglied → JWT-Header, Spielerlink ohne Mitgliedschaft → kein globaler Zugriff, statischer RLS-/Rollback-Vertrag. Keine produktiven Requests aus GitHub-CI.

## Zwingende Cutover-Gates

1. **Nichtöffentlichen Familien-Client-Build und privaten Auslieferungsweg herstellen.** Der öffentliche PR-/Branch-Code ist noch keine private Auslieferung. Bestehende Familien-PWA darf nicht vorab durch Live-Revoke gebrochen werden.
2. Synthetische Node-/Playwright-Tests und tatsächliche iPhone-/Desktop-Funktionsprüfung für Home, Kalender, Mannschaften, Volltextsuche, private Trophäen, Offline/PWA, Einladungsannahme, widerrufene/abgelaufene Spielerlinks. Mindestens `anon`, nicht eingeladenes `authenticated`, echtes Mitglied und eingeschränkte Spielerlink-Sitzung gegeneinander testen. Keine personenbezogenen Testlogs.
3. SQL-Drift und Migration/Rollback in isolierter kostenloser Testumgebung ohne Produktionsdaten nachweisen; keine kostenpflichtige Supabase-Branch-Ressource ohne Kostenfreigabe.
4. Familien-Client privat bereitstellen und erfolgreiche Verbindung verifizieren; erst danach atomare Live-Umstellung in **ausschließlich** Badminton-Projekt, unmittelbar `anon`/nicht eingeladenes `authenticated` negativ und Familienmitglied positiv prüfen. Bei Problemen kontrollierte Wiederherstellung; keine ungeprüfte öffentliche Rückfreigabe.
5. Getrennt: öffentliche Pages/Repository-Exposition und Git-Historie auf Personenbezug prüfen, geeigneten privaten Hosting-/Repo-Weg klären. Keine neue öffentliche Auslieferung bis ausdrücklicher Nutzerfreigabe.

## Stand und Restrisiko

**Der produktive Datenbankzugriff ist weiterhin öffentlich gemäß den 10 bisherigen Policies.** Der vorbereitete Branch beseitigt diese Schwachstelle noch nicht. Kein SQL wurde produktiv angewendet, keine Secrets geändert, keine Familienkonten gelöscht. Die gleichzeitige Client-/DB-Umschaltung bleibt der notwendige nächste sicherheitskritische Schritt.
