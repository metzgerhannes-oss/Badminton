# P0: Bedarfsimport einzelner historischer Badminton-Matches – v35

Stand: 10.10.2026. **Echte Einzelmatches aus den öffentlich dargestellten Badhub-Profilseiten werden seit heute in Supabase importiert.** Sie sind als *Drittanbieter-Matchkarten* gekennzeichnet und bleiben getrennt von offiziell verifizierten DBV-Match-IDs.

## Nachgewiesene Quelle
- Badhub zeigt unter `/spieler/<DBV-ID>?src=turnier&saison=all` Turnierkarten nach Veranstaltung/Disziplin/Phase mit Spielernamen, Ergebnis und Satzständen. Unter `?src=liga&saison=all` stehen Ligaspiele mit verlinktem Spielbericht.
- Badhub-`robots.txt` wurde gelesen: `Allow: /`, `Disallow: /cron/`. Der Import besucht **ausschließlich die öffentlichen Profilseiten**, nie interne Cron- oder nicht authentifizierte Endpunkte.
- Turnierkarten haben häufig **keine einzelne originale DBV-Match-ID**. Daher wird ein stabiler, **aus Veranstaltungs-ID + Disziplin + Runde + Gegnern/Teams abgeleiteter Quellschlüssel** verwendet. Dieser ist **keine offizielle DBV-Match-ID**.
- Ein Eintrag ist nur akzeptiert, wenn Selbstmarkierung/Spielername, eindeutige Seite, Gegner, mindestens zwei gültige Sätze und übereinstimmende gewinnende Teamseite belegt sind. Walkover-/fehlende/unklare Scorekarten werden nicht als gewonnenes oder verlorenes Match gezählt. Auch die erstmaligen Turniertage werden als **Turnierbeginn**, nicht als einzelner Matchzeitpunkt angezeigt.

## Realer Server-Test
- **Sarah Storz, 05-061350:** 677 dargestellte Matchkarten aus Liga+Turnier, davon **608 auswertbar**, 69 unklare/ungeeignete Quellkarten bewusst ausgeschlossen. Erste **120 Einzelnachweise** mit Gegnern, Satzständen, Event und Quelllinks in `public.player_external_match_facts` gespeichert. Weitere Batches werden automatisch fortgesetzt.
- **Philipp Metzger, 05-070879:** 62 Matchkarten gefunden, **42 korrekt auswertbar und komplett übernommen**, 20 unklare Karten ausgeschlossen.
- Ein Badhub-Karriereaggregat wie **678 Spiele / 388 Siege** für Sarah ist eine **andere Datenebene** und muss nicht mit der Zahl auswertbarer Einzelmatches übereinstimmen. Keine nachträgliche Differenz zu Siegen/Niederlagen fingieren.
- Bei Charlotte/anderen Spielern ohne verfügbare öffentliche Matchseite wechselt der Importstatus auf `awaiting_source`, statt stündlich Fehler zu erzeugen oder zu behaupten, es gebe keine Karriere.

## Architektur
1. Durch **Folgen** oder **Anlegen eines eigenen DBV-Profils** erstellt die PWA bereits den geprüften zentralen Importauftrag. Danach ruft sie die serverseitige Supabase-Edge-Function `history-match-import` auf. Bei bereits gespeicherten Profilen genügt die zentrale Warteschlange.
2. Nur **DBV-IDs bestehender, verifizierter Spieler mit vorliegendem Importauftrag** dürfen von der Edge-Function importiert werden. `public.claim_external_match_import` (ausschließlich `service_role`) erzwingt ein exklusives 3-Minuten-Lease, mindestens zehn Minuten zwischen Läufen und höchstens 36 Quellimporte in einem 24-Stunden-Fenster. Zwei öffentliche Profilaufrufe je Lauf, begrenzte HTML-Größe.
3. Die Edge-Function liest beide HTML-Seiten, führt einen **feldgenauen Parser** aus (`scripts/badhub-history-parser.mjs`) und schreibt pro Lauf maximal 120 **strukturierte Fakten**, ohne HTML zu speichern; Idempotenz per `(dbv_id,source_key)`. Aktuelle technische Statuswerte stehen in `player_external_match_imports`.
4. Der Cronjob `badminton-history-match-batches` verarbeitet **alle 30 Minuten höchstens ein** offenes Profil weiter. Dadurch setzt sich Sarahs Import fort, auch wenn die App geschlossen wurde. Der Globallimit-Trigger gilt für App und Cron gleichermaßen.
5. Die PWA lädt `player_external_match_facts` nur beim Betreten von **Historie** für die gerade ausgewählte DBV-ID. Zu sehen sind Jahr-, Disziplin- und Turnier/Liga-Filter, Gegner, ggf. Doppelpartner, Satzstände aus der korrekten Spielerperspektive und der Originalquellenlink. Über `Weitere Spiele anzeigen` kann man die sichtbare Liste erweitern.
6. **Wichtig:** `public.matches`, `public.match_games`, `player_match_observations` und die damit verbundenen **offiziellen Match-KPIs bleiben unberührt**. Bei fehlender Quellenvalidierung werden keine fiktiven Ergebnisse eingetragen. Bestehende Badhub-Gesamtsummen sind **nicht mit den neu importierten Teilmengen zu addieren**.

## Zugriff und rechtliche Grenzen
- Beide neuen `public`-Tabellen haben RLS; `anon`/authenticated dürfen nur `SELECT` lesen. **Schreiben ausschließlich serverseitig** mit dem Edge-Service-Rollenschlüssel. Keine persönlichen Followerlisten werden in Supabase gespeichert; nur öffentlich bekannte DBV-IDs.
- Die Edge-Function akzeptiert nur eine gültige DBV-ID und öffentliche Publishable-Key-Anfrage, überprüft vorher den geclaimten Import und hat eine harte globale Quotenbegrenzung. Das Publishable-Key-Feld ist **keine persönliche Authentifizierung**.
- Es werden keine größeren Kopien des Badhub-HTMLs gespeichert, nur einzelne belegbare Ergebnisse. Automatisch sichtbare öffentliche Inhalte und `robots.txt` begründen **nicht** automatisch das Recht, beliebig große Teile der Datenbank dauerhaft anderswo zu veröffentlichen. Daher strikte Abruf- und Speicherlimits, Quellenlinks und keine flächendeckende Spiegelung aller 9.246 Spieler.
- Nicht alle Badhub-Begegnungen sind vollständig. Für nicht auswertbare Karten erfolgt kein Sieg/Niederlage. Ein echter Turniertag- und iPhone-Sichttest bleibt Teil der fachlichen Abnahme.

## Projektdateien
- `database/external-match-import.sql`: RLS, Quellbelege, Service-Role-Claim, 24h-Rate-Limit.
- `database/external-match-cron.sql`: Fortsetzung über private Supabase-Cronfunktion.
- `supabase/functions/history-match-import/index.ts`: laufender, begrenzter Quellabruf und Upsert.
- `scripts/badhub-history-parser.mjs`: pure Parser-/Score-Konsistenzregeln.
- `external-matches.js`, `index.html`, `design-v2.css`: Historienkarte, Filter und mobile UX.
- `history-demand.js`, `welcome.js`: Auslöser beim Folgen/eigenen Profil.
- `tests/external-match-parser.mjs`: synthetische, quellgetreue Matchergebnis-Fixtures.
