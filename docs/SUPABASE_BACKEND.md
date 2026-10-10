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
