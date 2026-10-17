# Badminton · Freeplan-Speicher und Aufbewahrung (17.10.2026)

## Aktueller technischer Ausgangspunkt

**Nur das separate Badminton-Projekt** `yadexibmjmnjfmfabrug`, niemals das Gartenwelt-Projekt. Die reale Abrechnung auf der Supabase-Usage-Seite ist maßgeblich; `pg_database_size` misst PostgreSQL-interne Bytes, nicht unbedingt die verrechneten Provider-Bytes.

- PostgreSQL-Datenbank am 17.10.: **42.219.187 Bytes** (~42,2 MB dezimal, ~40,3 MiB).
- Nominelles Free-Datenbankbudget: 500 MB, wie auch in der Supabase-Oberfläche ausgewiesen; interne Auslastung ~8,4 %. Im früheren Usage-Dashboard wurden **0,057 von 0,5 GB** ausgewiesen (~11 %) – ein anderer Zähler.
- Größte Tabellen inkl. Indizes: Spieler ~6,5 MB, Ranglisten ~4,1 MB, `spvgg_match_rebuild_stage` ~4,0 MB, privates Evidenzarchiv ~3,3 MB, Liga-Spielpläne ~2,2 MB.
- Die aktive DBV-Ranglistenmigration bewahrt max. **acht offizielle Wochenstände** auf. Ein aktueller Wochenstand ist **auch für Spieler ohne Turnier in dieser Woche gültig**; keine Reduktion auf Turnierteilnehmer.
- Bereits bestehende technische Aufbewahrung: `cron.job_run_details` 7 Tage; abgelaufene private Einladungen werden täglich gelöscht; `private_content.import_health_weekly` 90 Tage.

## Speicherbeobachtung ohne Zusatzkosten

Der **bereits laufende Montags-Cronjob** `badminton-import-health-weekly-v1` (07:49 UTC) erhält mit der neuen Migration zusätzliche anonymisierte Werte in seiner bisherigen privaten 90-Tage-Tabelle:

- PostgreSQL-Datenbankbytes, Prozent am **nominellen** 500-MB-Budget und letztes gespeichertes Wochen-Sample
- Bytes des Match-Zwischenspeichers und der historischen Reimport-Sicherung
- Zählwerte zu Zwischendatensätzen ohne eindeutigen canonical/quarantine-Abgleich und Backup-Zeilen außerhalb des aktuellen Matchbestands
- Anzahl vorgehaltener Ranglistenwochen, zur Kontrolle der Acht-Wochen-Grenze

**Ab 70 %** der technischen 500-MB-Basis: `attention`, Speicherwachstum und größte Tabellen prüfen. **Ab 85 %**: `attention` mit `storage_watch_level=critical`, vor größeren Importen ggf. Datenstruktur optimieren. Der externe Billing-Zähler kann abweichen und muss bei Bedarf separat betrachtet werden.

Keine neue geplante Abfrage, kein zusätzlicher Edge-Lauf, kein fremder Analyticsdienst, keine Protokollierung von Spielern, Gegnern, IPs oder Quelldokumenten.

## Nicht automatisch löschen

| Bestand | Wert am 17.10. | Vorgehen |
|---|---:|---|
| Match-Zwischenspeicher | 2.009 Quellzeilen, ca. 4 MB | **31** Quellschlüssel fehlen im canonical Matchbestand **und** in Quarantäne. Kein automatisches Löschen, bis Prüfung abgeschlossen |
| Reimport-Sicherung vom 15.10. | 839 Zeilen, ca. 0,5 MB | **347** Quellschlüssel nicht im canonical Matchbestand. Die Sicherung bleibt, solange Herkunft/Abgleich offen |
| Aktuelle verifizierte Matchdaten und Evidenzarchiv | ~1.987 Einzelspiele | Behalten, nicht nach Alter ausdünnen |
| Ranglisten | 17.790 aktuelle Einträge KW42 | Maximal acht veröffentlichte Wochenstände; bestehende fachlich richtige Retention beibehalten |
| Turnierplatzierungen/Spielberichte | 87 Platzierungen | Historische Daten bleiben erhalten |
| Import-Quarantäne | 52 abgewiesene Quellzeilen | Für fachliche Fehleranalyse aufbewahren; kein pauschales Löschdatum |

Eine mögliche künftige **einmalige** Bereinigung des Staging-Bestands darf nur nach überprüfter Übernahme oder begründeter Quarantäne *jeder* zu löschenden Quellzeile und unverändert vollständigem Matcharchiv erfolgen. Kein pauschales `TRUNCATE` oder `DELETE` für produktive Matchbelege.

## Grobe Szenariorechnung, keine Prognose

Mit dem gemessenen Startwert von ~42,2 MB PostgreSQL-Bytes und **angenommenen** zusätzlichen 1–5 MB pro Monat ergäben sich:

| Zeitraum | +1 MB/Monat | +5 MB/Monat |
|---|---:|---:|
| 3 Monate | ~45 MB | ~57 MB |
| 6 Monate | ~48 MB | ~72 MB |
| 12 Monate | ~54 MB | ~102 MB |
| 24 Monate | ~66 MB | ~162 MB |

Diese Spanne ist ausdrücklich **keine Messung zukünftigen Wachstums**; das Projekt verfügt noch nicht über genügend wöchentliche Speicher-Snapshots für eine belastbare Trendprojektion. Erst nach mindestens vier regulären Wochenmessungen Wachstum bewerten und anhand tatsächlicher Quellen-/Importzahlen nachsteuern.

## Reproduzierbare Prüfung (ausschließlich lesend)

```sql
SELECT pg_database_size(current_database()) AS database_bytes;
SELECT checked_on,status,
       summary->>'pg_database_bytes' AS pg_database_bytes,
       summary->>'storage_watch_level' AS storage_watch_level,
       summary->>'stage_cards_unreconciled' AS stage_cards_unreconciled,
       summary->>'backup_cards_not_in_current' AS backup_cards_not_in_current
FROM private_content.import_health_weekly
ORDER BY checked_on DESC LIMIT 5;
SELECT jobname,schedule,active FROM cron.job
WHERE jobname='badminton-import-health-weekly-v1';
```

**Release-Abnahme:** Offline-CI und mobile QA grün; gezielte Migration im **richtigen** Supabase-Projekt angewandt; ein erster erfolgreicher Wochenbericht gespeichert; kein weiterer Cronjob und keine Sportergebnisse gelöscht. Beim Status `attention` erst die aggregierten Abweichungen prüfen.
