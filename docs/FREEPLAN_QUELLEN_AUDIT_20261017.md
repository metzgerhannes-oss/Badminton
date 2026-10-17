# Schmetterlinge – Freeplan, Quellenabdeckung und Imports (17.10.2026)

## Geltungsbereich

Nur Badminton Supabase-Projekt `yadexibmjmnjfmfabrug` (Organisation Badminton), GitHub `metzgerhannes-oss/Badminton`, Cloudflare Pages `schmetterlinge-language-packs`. Das getrennte Gartenprojekt darf nicht geprüft oder verändert werden, um diese Zahlen zu ermitteln. **Kostenobergrenze: 0 €**, kein kostenpflichtiges Upgrade, keine Log-Drains oder externen Monitoringanbieter.

## Messung und Grenzen

| Kennzahl | Beobachtung 17.10.2026 | Beleg / Einschränkung |
|---|---:|---|
| Supabase-Datenbank | 42.079.923 Bytes (~40 MiB) | Live `pg_database_size(current_database())`, inklusive relationaler Daten und Indizes |
| Datenbank-Freikontingent | 500 MB / Projekt | https://supabase.com/pricing |
| Spieleridentitäten | 9.350 | `public.players`; alle 13 erfassten Vereinsspieler haben KW42-Einträge |
| Ranglisten KW42 | 17.790 Wertungen / 9.310 Spieler | 6 Disziplinen; vollständiger offizieller DBV-Wochenstand, 17.10. importiert |
| Aktuelle Ranglistenwochen | 2 | Speicherung auf maximal **acht** Wochen begrenzt durch `20261016214500_private_weekly_rankings.sql` |
| Externe Matchbelege | 1.977 / 12 Personen | Nur bestätigte Badhub-Einzelkarten; kein Nachweis vollständiger Karrieren |
| Noch ohne Matchquelle | 1 Importauftrag | `awaiting_source`; belegte Ranglistenpunkte ersetzen keine Matches |
| Importquellen | 17 registriert | Quellenregister: 9 verifiziert, 8 Kandidaten (Quellenprüfung ≠ Importvolumen) |
| DBV-Kalender | 284 Termine | Erforderlich: Aktualität, Dubletten und Quellabgleich |
| Supabase Logs Ingest | 1,74 GB von 1 GB (Snapshot 15.10.) | **Historischer Dashboardwert, keine neue Monatsmessung.** Gegenwartswert nur im Usage-Dashboard |
| Cloudflare Pages | 141 Produktions- und 2.407 Preview-Deploymentdatensätze | 17.10., Preview-Branch-Setting bereits `none`; queued/idle ≠ verbrauchter Build |

Die SQL/Connector-Zahlen sind Momentaufnahmen, nicht automatisch eine verifizierte monatliche Rechnung. Die Free-Grenzen für Datenbank, Egress und Logs auf https://supabase.com/pricing und https://supabase.com/docs/guides/platform/manage-your-usage/logs-ingest regelmäßig prüfen.

### Betriebsroutine

- **Wöchentlich (Montag):** GitHub Actions `Badminton Importbestand lesen` führt nur lesend den bereits existierenden, begrenzten öffentlichen Quellen-/Match-Abdeckungscheck aus. Der Zeitplan benutzt `--aggregate-only` und **schreibt keine Namen, DBV-IDs, Gegner, Rohkarten oder Zugangsdaten in Logs oder Artefakte**. Nur manuelles `workflow_dispatch` erstellt weiterhin optional einen befristeten Detailbericht.
- **Monatlich oder nach Änderung der CI:** Im [Badminton Usage-Dashboard](https://supabase.com/dashboard/project/yadexibmjmnjfmfabrug) tatsächliche Logs Ingest, Egress, Storage, Functions Invocations messen. Es existiert derzeit kein berechtigter API-Zugriff auf verifizierte Rechnungs-/Usage-Gesamtzähler; deshalb keine Prozentwerte dafür erfinden. Primäres Betriebsrisiko: [#255](https://github.com/metzgerhannes-oss/Badminton/issues/255).
- **Cloudflare:** Live-Änderung am 17.10.2026 bestätigt: Im reinen Sprachpaket-Pages-Projekt wurde `source.config.path_includes` von `['*']` auf `['locales/*']` begrenzt. Automatische Preview-Builds bleiben `none`, Produktion auf `main` weiterhin aktiviert. Änderungen außerhalb `locales/` lösen dort nicht mehr automatisch neue Deployments aus; tatsächliche Build Usage gesondert beim Anbieter prüfen.
- **Tests:** normale PR-/Push-/Playwright-Tests bleiben *synthetisch*, gegen produktives Supabase netzwerkgesperrt. Nur bewusste, eng begrenzte oder ausdrücklich eingeplante Live-Datenimporte dürfen echte Plattformzugriffe ausführen.

## Quellenregel – Priorität P0

1. **Ranglisten sind aktuelle publizierte Zustände**, nicht die Summe ausschließlich aktueller Turnierteilnahmen. Die offizielle KW42-Gesamtpublikation kommt über das signierte, atomare DBV-Importverfahren. Pro Spieler kann es bei fehlenden Disziplinwerten begründete Leermeldungen geben.
2. **Einzelmatches brauchen direkte Quellenbeweise** für Spieleridentität, Begegnung und Ergebnis. Ranglistenpunkte, Punktzahl, Turnierplatz und Presseerwähnung **niemals** als gespielte Begegnung importieren.
3. Quellenfolge: offizielle DBV-/BWBV-Turnier- bzw. Auslosungsseiten, zulässige Ergebnis-/Matchkarten-Quellen und bestätigte Vereinsberichte. Bei unzugänglicher Einzelmatchquelle bleibt `awaiting_source` oder `partial`; bestehenden Ranglisten-/Platzierungsbestand nicht löschen.
4. Für alle 13 registrierten Vereinsspieler Quellzeitraum, vorhandene verifizierte Matches, Quellenlücken, ausgeschlossene Karten und Berechtigungs-/Anzeigestatus **intern** getrennt dokumentieren. Die öffentlichen Issues [#194](https://github.com/metzgerhannes-oss/Badminton/issues/194) und [#199](https://github.com/metzgerhannes-oss/Badminton/issues/199) enthalten keine Namen oder DBV-IDs einzelner Minderjähriger.
5. Keine allgemeine, serverseitig ungeprüfte Datenfreigabe. Importänderungen über Branch → PR → Offline-CI → Freigabe → gezielte Live-Abnahme.

## Speicherbudget / Retention

- Die DBV-Ranglistenmigration hält höchstens acht offizielle Wochenstände (konkret im SQL überprüft). Keine monatlichen Voll-Excelkopien oder personenbezogenen GitHub-Build-Artefakte.
- Die schon vorhandene Cron-Aufbewahrung entfernt technische `cron.job_run_details` älter als sieben Tage. Regelmäßige Matchstaging- und Archivbelege **nicht blind löschen**, solange noch ein Abgleich/Import benötigt wird.
- Ab 70 % des Datenbankbudgets Wachstum und größte Tabellen gezielt prüfen, ab 85 % keine zusätzlichen Massendatensätze ohne Budgetprüfung. **Historische geprüfte Turnierergebnisse niemals allein wegen Quotenverbrauchs unbemerkt löschen.**
- Keine neue Nutzerverfolgung, keine Speicherung von IPs, User-Agent-IDs, Gegnerprofilen oder Logs nur für das Monitoring. Keine personenbezogenen Projektstatus-Artefakte.

## Reproduzierbare lesende SQL-Abnahme

Nur im explizit gewählten **Badminton**-Projekt und nur bewusst bei Bedarf durchführen, nicht in CI:

```sql
select pg_database_size(current_database()) as database_bytes,
       pg_size_pretty(pg_database_size(current_database())) as database_size;
select relname as table_name, pg_total_relation_size(relid) as bytes
  from pg_stat_user_tables where schemaname='public'
  order by bytes desc limit 10;
select w.year, w.week, count(e.*) as entries, count(distinct e.player_id) as players
  from public.ranking_weeks w
  left join public.ranking_entries e on e.week_id=w.id
  group by w.id order by w.year desc,w.week desc;
select status, count(*) as players, sum(coalesce(verified_count,0)) as verified,
       sum(coalesce(rejected_count,0)) as rejected
  from public.player_external_match_imports group by status order by status;
select count(*) as staged, count(distinct dbv_id) as staged_players
  from public.spvgg_match_rebuild_stage;
```

Eine erfolgreiche technische SQL-/Actions-Ausführung allein belegt weder die Vollständigkeit der externen Quellen noch eine fehlerfreie Anzeige auf dem iPhone.
