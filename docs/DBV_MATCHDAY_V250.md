# v250 – Offizielle DBV-Matches am Turniertag (privat, on-demand)

## Ziel und Datenpfad

1. `public.dbv_matchday_targets` enthält **ausschließlich** geprüfte Kombinationen aus Turnier-UUID, verifizierter DBV-Spieler-ID und lokaler Turnier-Spieler-ID. Der Pilot verwendet Léonas DBV-ID `05-067866`, Turnier `836C93F3-7635-420B-B314-DEDB60884AB2`, lokale Spielerkennung `500`.
2. Nur wenn ein eingeladener Nutzer die **Turniertagansicht tatsächlich öffnet**, ruft die App die Edge Function `dbv-matchday-sync` auf. Eine Mitgliedschaftsprüfung über `app_access_status` ist zwingend. Während der sichtbaren Ansicht begrenzt ein Client-Throttle die Abfrage auf **höchstens alle fünf Minuten**; der Server begrenzt die Quellenprüfung zusätzlich.
3. **Kein Hintergrund-Cron, keine geplanten DBV-Abfragen**, keine dauerhafte Aufzeichnung der privaten Freundesliste. Das ursprünglich getestete Cron-Experiment wurde vor Freigabe bewusst wieder entfernt. Der Betrieb benötigt keinen separaten Cron-Token in Vault.
4. Die Edge Function lädt ausschließlich `https://dbv.turnier.de/tournament/<UUID>/player/<lokale-ID>` mittels normaler funktionaler Cookie-Einwilligung (`CookiePurposes=1`). HTML, Cookies, Sessions, Spieler- und Partnerlisten werden nicht als Rohdaten gespeichert oder geloggt.
5. Der begrenzte Parser prüft die **exakte** DBV-ID und lokale Spieler-ID und extrahiert nur eigene, belegte Spiele; undatierte Auslosungs-Platzhalter und fremde Spiele bleiben ausgeschlossen. Angesetzte Zeiten sind keine Live-Startgarantie.
6. Die Service-only-RPC `dbv_matchday_store` speichert validierte Daten **atomar** in `events`, `matches`, `match_participants`, `match_games`. Stabile interne Slot-Schlüssel machen erneute Läufe idempotent; früher bestätigte Ergebnisse werden nicht durch einen unvollständig geladenen Plan überschrieben.

## Reale Quellprüfung vom 7. November 2026

- Offizielle, inhaltlich verifizierte Spieleransicht liefert **vier** Léona-Partien: zwei beendete Mixed-Spiele (09:30 Uhr, Feld 9; 10:30 Uhr, Feld 7) sowie ein Einzel am Samstag 15:00 Uhr und ein Doppel am Sonntag 10:00 Uhr.
- Die Quelle wurde erfolgreich im Edge-Server ausgelesen und die atomare Datenbanktransaktion testweise ausgeführt: `stored=4`, `finished=2`, keine Dubletten.
- Der frühere Cron-basierte End-to-End-Probelauf war erfolgreich, ist aber **nicht** mehr der aktuelle Betriebsmodus. Für den endgültigen Mitgliedsaufruf ohne Test-JWT gilt die Chromium-/WebKit-Abnahme als technische Browserprüfung, nicht als Nachweis eines echten Benutzer-Logins.
- Kosten: keine zusätzliche kostenpflichtige Infrastruktur, keine DBV-Abfragen bei geschlossener App.
- Der exakte Turnier-/Spieleridentitätsnachweis ist Voraussetzung für weitere verfolgte Personen. Es gibt **keine** pauschale automatische Registrierung aller Freunde aufgrund gleichlautender Namen.

## Betriebsprüfung (nur für Administratoren)

```sql
SELECT dbv_id,active_until,last_match_count,
       last_checked_at,last_success_at,last_error_at,error_code
FROM public.dbv_matchday_targets;
SELECT count(*) AS background_jobs
FROM cron.job WHERE jobname='badminton-dbv-matchday-five-minutes';
```

Der zweite Wert muss im aktuellen **on-demand-Modus 0** sein. Die Tabelle ist durch RLS sowie fehlende `anon`- und `authenticated`-Rechte geschützt. Die Matchansicht liest nur für freigegebene Familienmitglieder.

**Fehlerverhalten:** Ein Abruffehler ist nicht gleichbedeutend mit „keine Matches“. Bestehende Quellresultate bleiben erhalten; `last_error_at` wird gesetzt. Status `scheduled` wird nie allein wegen abgelaufener Uhrzeit als `playing` gekennzeichnet.
