# v250 – Offizieller DBV-Turniertag (privater Betrieb)

## Datenpfad

1. In `public.dbv_matchday_targets` stehen nur **belegte** Paare aus DBV-Turnier-UUID, verifizierter DBV-Spieler-ID und der vom offiziellen Turnierprofil verlinkten lokalen Spieler-ID.
2. Der kostenlose pg_cron-Job `badminton-dbv-matchday-five-minutes` läuft alle fünf Minuten. Er ruft außerhalb eines aktiven Turniers oder außerhalb 07:00–22:00 Uhr (Europe/Berlin) **keinen** externen Dienst auf. Bei Aktivitäten verschickt er ausschließlich einen kurzlebig gehaltenen Vault-Token an die Edge Function `dbv-matchday-sync`.
3. Die Edge Function verifiziert entweder den Vault-Token oder bei der direkten Turniertag-Anfrage die Supabase-Familienmitgliedschaft. Der Token steht niemals im Quellcode. Als öffentliche DBV-Quelle wird ausschließlich `https://dbv.turnier.de/tournament/<UUID>/player/<lokale-ID>` geladen.
4. Der normale Session-Flow akzeptiert nur technisch notwendige Cookies (`CookiePurposes=1`). HTML, Cookies und Session-Daten werden **nicht** gespeichert, exportiert oder protokolliert.
5. Der Parser fordert exakte DBV-Spieler-ID + lokale Spieler-ID, gültige Termine, Konkurrenz, Runde, Teilnehmeridentitäten und veröffentlichte Satzdaten. Undatierte Auslosungspositionen, nicht belegte LIVE-Status und fremde Partien werden verworfen.
6. Die RPC `dbv_matchday_store` speichert eine vollständige gültige Antwort **in einer Transaktion** in `events`, `matches`, `match_participants`, `match_games` und aktualisiert den Watch-Status. Wiederholung erzeugt keine Dubletten; spätere Startzeit-/Feldänderungen bleiben derselben Spieler-/Draw-/Rundenposition zugeordnet.

## Konkrete Abnahme 07.11.2026

- Ziel: Léona (DBV 05-067866), Südostdeutsche Meisterschaften Augsburg, lokale Spieler-ID 500.
- Echte Ausgangsdaten: 4 Spielerpartien, 2 gespielt, 2 angesetzt (09:30 und 10:30 Mixed am Samstag, 15:00 Einzel am Samstag, 10:00 Doppel am Sonntag).
- Live-API-Test über pg_net und Edge: HTTP 200, `checked=1`, `failed=0`, `stored=4`.
- Tatsächlich aktiver Cron-Lauf erfolgreich; Datenschutz/RLS: keine Datenbank-Tabellenfreigabe für `anon`, keine Match-Schreibrechte für Familienmitglieder.
- Privater Produktionsbranch, nicht `main`.

## Betrieb und Fehleranalyse

Aktuellen Stand (nur privilegiert):

```sql
SELECT dbv_id,active_until,last_match_count,last_checked_at,
       last_success_at,last_error_at,error_code
FROM public.dbv_matchday_targets;
SELECT jobid,active,schedule FROM cron.job
WHERE jobname='badminton-dbv-matchday-five-minutes';
```

- `last_success_at`: Quelle und Datenbanktransaktion erfolgreich.
- `last_error_at`: Quelle oder Validierung momentan nicht erreichbar; vorhandene Ergebnisse bleiben bestehen. Keine Aussage „keine Spiele“ aus einem HTTP-Fehler ableiten.
- `scheduled` darf nicht als tatsächliches Aufrufen oder laufendes Spiel ausgegeben werden.
- Für weitere Freunde zuerst den verifizierten offiziellen Turnier-Player-Link samt DBV-ID nachweisen und anschließend **nur dieses** Ziel in `dbv_matchday_targets` hinterlegen. Nicht aufgrund von Namen, Orten oder Mannschaften zuordnen.
- Der Code importiert keine anonymen Spielerdatenbanken, keine Turnier-Vollarchive und überschreibt keine fremden Quellen.

## Technische Grenze

Der Dienst zeigt aktualisierte veröffentlichte DBV-Werte in Fünf-Minuten-Abständen. Er beweist keine sofortige Live-Feldmeldung und keine Sekunden-genauen Spielbeginne. Ohne tatsächlich veröffentlichte Startzeit, Gegner oder Feld bleiben diese Angaben offen.
