# Verbindlicher Live-Zugriff – bestätigt am 12.10.2026

**Badminton-Supabase ist über ChatGPT direkt erreichbar.** Verwendbare Projekt-ID: `yadexibmjmnjfmfabrug`, Organisation `ulxwbtojkytbzuosftkg`, Frankfurt (`eu-central-1`). Der allgemeine Connector-Aufruf `list_projects` zeigte in der Prüfung nur `JohannasGartenwelt`; das ist **kein fehlendes Zugriffsrecht auf Badminton**. Die direkten Connector-Aufrufe `get_project({id:"yadexibmjmnjfmfabrug"})`, `list_tables({project_id:"yadexibmjmnjfmfabrug",schemas:["public"],verbose:false})`, `execute_sql`, `list_migrations` und `get_advisors` funktionieren. **Bei künftigen Badminton-Arbeiten stets die konkrete Badminton-Projekt-ID übergeben; nicht allein aus der Projektliste auf fehlenden Zugriff schließen.** Die Gartenwelt-Instanz `ilfblkqxbldkzmqczbgo` unter anderer Organisation niemals als Ersatz verwenden.

**Ergebnis der nichtschreibenden Prüfung (12.10.2026):** Projekt ACTIVE_HEALTHY, PostgreSQL 17.11, 22 öffentliche Tabellen, alle RLS-aktiv; 9.246 Spieler, 916 Vereine, 835 externe Matchbelege; Security Advisor 0 Befunde. Produktive Migrationen `20261011194527 shared_tournament_links_v87` und `20261011200147 shared_tournament_projection_v88` sind vorhanden. In GitHub ist v88 auf `main` (`25888ad12e5f`) integriert; die regulären und mobilen CI-Prüfungen sowie das Pages-Deployment waren grün. Die zwei neuen Freigabetabellen waren bei der Prüfung leer, ebenso `auth.users`: **kein echter Geräte-zu-Geräte-Veröffentlichungstest belegt**.

**Wichtige Abgrenzung:** Die bestehenden RLS-Policies begrenzen die privaten `user_tournament_links` auf `auth.uid() = user_id`, und `shared_tournament_hints` ist für `anon` ausschließlich lesbar. Das bestätigt **nicht**, dass ein Benutzer zum Veröffentlichen für eine bestimmte öffentliche DBV-Spieler-ID berechtigt ist: die aktuelle Prüfung nutzt `players.verified_at` (Quellidentität), nicht den Nachweis, dass der Auth-Benutzer dieses Spielerprofil verwalten darf. Gemeinschaftseinträge sind daher nur als unbestätigte Nutzerhinweise zu kennzeichnen. Für eine verbindliche Freigabe des in #101 verlangten Verwalter-Nachweises ist eine echte Berechtigungsbindung nötig; für Minderjährige besonders beachten. Die reale Zwei-Geräte- und Widerrufsabnahme bleibt ebenso offen. Die allgemeine Connector-Projektliste ist kein funktionaler Freigabeblocker mehr.

---

# Supabase-Backend – Badminton / Schmetterlinge

Stand: 10.10.2026

## Verbindung

- Supabase-Organisation: **Badminton** (Free)
- Projekt: `yadexibmjmnjfmfabrug` in `eu-central-1` (Frankfurt)
- API-Basis: `https://yadexibmjmnjfmfabrug.supabase.co`
- Dashboard: https://supabase.com/dashboard/project/yadexibmjmnjfmfabrug
- Frontend: `live.js` nutzt ausschließlich den **publishable** Schlüssel. Private/Service-Keys dürfen niemals in GitHub-Dateien, den Browser oder die PWA gelangen.

## Persistierte Entitäten

| Tabelle | Inhalt |
|---|---|
| `players` | Öffentliche DBV-Spielerkennungen, Name/Verein |
| `tournaments` | Offizielle DBV-Turniere mit Quellen-URL und Zeiten |
| `events` | Konkurrenzen, Altersklassen und Disziplinen |
| `matches` | Paarungen, Aufruf, Spielstatus, Feld und Startzeit |
| `match_participants` | Seite 1/2, Einzel- oder Doppelspieler |
| `match_games` | Satzstände je Begegnung |
| `ranking_weeks` / `ranking_entries` | Offizielle DBV-Gesamtpunkte, KW und Altersklassenrang |
| `tournament_placements` | Kuratierte, separat belegte Turnierplatzierungen |
| `user_players` | Privater Eltern-/Spielerbereich (Login später aktivieren) |
| `user_tournament_links` | Private DBV-Turnierfavoriten (Login später aktivieren) |
| `private.sync_runs` | Geschützte Protokolle des Quellenimports |

**Bereits importiert:** die beiden verifizierten DBV-Spielerprofile, alle 16 kuratierten Platzierungen aus `data/history.json`, die vier offiziellen KW41-Gesamtwertungen aus `data/ranking.json` sowie der bestätigte DBV-Turnierdatensatz vom 11.07.2026. Dies ist ein **einmaliger Initialimport**, kein laufender Sync.

## Verlässlichkeit und Live-Daten

**Kein erfundener Live-Status.** DBV-Match-/Satzdaten sind erst sichtbar, wenn eine verifizierte Importquelle konkrete Datensätze geliefert hat. Die Datenbank hat aktuell noch keine Matchdatensätze. Besonders die offizielle Plattform `dbv.turnier.de` zeigt teilweise eine Cookie-Seite; ein zulässiger und stabiler Live-Datenabruf ist noch nicht eingerichtet. Der bestehende offizielle Turnierlink ist deshalb weiterhin der Fallback.

Die Supabase-Realtime-Publikation enthält `matches` und `match_games`. Im Frontend ruft `live.js` den schreibgeschützten REST-Endpunkt ab, bei geöffneten Turnieren periodisch alle 60 Sekunden und auf Nutzeranforderung. Ein Datenbank-Realtime-Event-Abonnement ist **noch nicht** in `live.js` implementiert. Die Frische jedes DBV-Abgleichs muss über `last_synced_at` ausgewiesen werden; ab 15 Minuten gibt die Ansicht einen Hinweis.

Die Ranglisten sind nur als **offizielle Gesamtwerte** importiert. Einzelwertung/Top-5 nie aus Platzierungen oder Veränderungen der Gesamtsumme schätzen; verbindliche Regel: `docs/DATENQUELLEN_PRIORITAET.md`.

## Sicherheitsmodell

- Öffentliches DBV-Material: `anon` / `authenticated` haben nur SELECT; Änderungen ausschließlich durch vertrauenswürdige serverseitige Importe.
- `user_players` und `user_tournament_links`: RLS mit `auth.uid() = user_id`; keine fremden Favoriten lesbar. Ohne Online-Login verbleiben bisherige PWA-Profile wie zuvor im lokalen Browser.
- `private.sync_runs` ist nicht über die Data-API freigegeben.
- Alle Tabellen sind RLS-aktiv; Supabase Security Advisors meldeten am 10.10.2026 **keine Findings**.
- Vorhandenes `public.rls_auto_enable()` wurde für `anon`/`authenticated` vom direkten RPC-Aufruf ausgeschlossen.

## Nächste Integrationsschritte

1. Offizielle DBV-Quelle für aktuelle Begegnungen einschließlich Spiel-ID, Teilnehmenden, Uhrzeit, Feld und Satzresultaten identifizieren und Zugriff/Zulässigkeit prüfen.
2. Serverseitigen Import mit unveränderlicher Quellen-ID, Upserts und `private.sync_runs` implementieren. Keine Service-Schlüssel in Clients.
3. Authentifizierten Elternlogin und opt-in-Synchronisierung der bisherigen lokalen Profile/Favoriten ergänzen; niemals lokale Favoriten ungefragt überschreiben.
4. Automatischen wöchentlichen DBV-Ranglistenimport zusätzlich zum bisherigen GitHub-JSON in Supabase spiegeln.

### Beispiel-Prüfungen

```sql
select dbv_id,name from public.players order by dbv_id;
select count(*) from public.tournament_placements;
select p.dbv_id,r.discipline,r.points from public.ranking_entries r
 join public.players p on p.id=r.player_id
 join public.ranking_weeks w on w.id=r.week_id
 where w.year=2026 and w.week=41;
select count(*) from public.matches;
```
