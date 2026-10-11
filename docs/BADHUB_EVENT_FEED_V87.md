# Schmetterlinge v87: Badhub-Veranstaltungsergebnisse im LIVE-Bereich

## Realitätsnachweis (11.10.2026)
Ein öffentliches Badhub-Beispiel `https://badhub.de/bvbb/turnier.php?id=4962` liefert auf `?id=4962&disc=offenes%20Doppel%20U9` Spielpaare, Gewinnerseite und einzelne Sätze. Der kostenlos betriebene Cloudflare Worker `schmetterlinge-event-feed.metzger-hannes.workers.dev` hat für diese Disziplin **10 einzelne Matchzeilen** gelesen und als begrenztes JSON bereitgestellt (HTTP 200). Beispiel: 4:15, 7:15. Quellenanzeige und Ergebnisparser bewahren die vom Anbieter gegebene Seitenreihenfolge und Siegerkennzeichnung. Dieser Quellenbeleg ist keine DBV-eigene Match-ID.

## Datenweg
1. **LIVE → Alle Spiele → Veröffentlichte Turnierspiele** öffnen.
2. Badhub-Turnierlink einmalig einsetzen, z. B. `https://badhub.de/bvbb/turnier.php?id=4962`. Der kanonische Link wird ausschließlich auf diesem Gerät der gewählten **DBV-Turnier-ID** zugeordnet. Ohne gespeichertes DBV-Turnier gibt es den lokalen Schlüssel `global`.
3. Schmetterlinge ruft ausschließlich den eingegrenzten, kostenlosen Cloudflare-Worker auf; dieser holt nur die angeforderte öffentliche Veranstaltungsübersicht bzw. **eine Disziplin** und bestätigt den eventbezogenen Antwortbeleg.
4. Die App bietet die vom Anbieter veröffentlichten Disziplinen als Auswahl; nach Auswahl werden die Seiten der Begegnungen mit Paarungen, Sätzen und ausgewiesener Gewinnerseite dargestellt.
5. Antworten werden fünf Minuten gecacht. Kein dauerhafter Import in `matches`, `match_games` oder Spieler-W/L. Kein API- oder Admin-Token im Browser. Keine Familienprofile in Cloudflare.

## Vertrauensgrenzen
- **LIVE der eigenen/gefolgten Spieler:** Das bestehende Supabase-Badhub-Spieler-Radar liefert aktuelle Aufrufe, Wartestände und frische Satzmeldungen (eigene Quellen-/Stale-Checks).
- **Veranstaltungsergebnisse:** Der neue Badhub-Adapter liest vorhandene veröffentlichte Ergebniszeilen; es gibt dabei noch keine verifizierte DBV-Match-ID, Quelle-spezifische letzte Änderung, vollständigen Spielbeginn, Echtzeitfeld oder Vollständigkeitsgarantie. Im UI ausdrücklich nicht als verifizierter offizieller DBV-Livestand dargestellt.
- **Offiziell importierte DBV-Matches:** Bleiben nachweisgestützt aus den eigenen Supabase-Matchtabellen; fehlende Matches sind dort keine Behauptung, dass es keine Turnierbegegnungen gibt.
- Die Spielerergebnisse werden nicht ungeprüft mit offiziellem Turnier-W/L verrechnet. BYE/W.O. ohne nachgewiesene gespielte Sätze nicht einrechnen.
- Anbieterrechte/Weiteranzeige und zulässige Aktualisierung langfristig abstimmen. Kein Massenarchiv, kein Login-Bypass, keine verschleierten Abrufe.

## Begrenzungen des Workers
- Nur `GET /v1/event` für canonical `https://badhub.de/<freigegebener-verband>/turnier.php?id=<dezimal>`.
- HTTP-Redirects von der öffentlichen Badhub-Quelle werden abgelehnt.
- Ein einziger Quellabruf je Anfrage und Disziplin, mit 8-Sekunden-Timeout, 900-KB-Maximum und 300-Sekunden-Cache.
- Nur bekannte Verbands-Unterpfade, nur integer Event-ID, maximal 120 Zeichen je Disziplin, max. 32 Disziplinen, max. 200 Matches, HTML wird serverseitig gelesen und nie als HTML an den Browser weitergereicht.
- CORS nur zum Schmetterlinge-GitHub-Pages-Origin.
- Unbekannte bzw. unvollständige Ergebnisse bleiben „Stand offen“.

## Nächste Forschungsfrage
Automatisches Pairing DBV-Event-UUID → Badhub-Veranstaltungs-ID aus **einem belegten, eindeutigen** Provider-Mapping. Die DBV-Turnierseite verwendet eine UUID, Badhub momentan eine interne numerische Event-ID. Ein bloßer gleichlautender Name reicht ohne Disambiguierung (Jahr, Zeitraum, Disziplin, Ort) nicht für automatische Zuordnung. Das einmalige Verknüpfen bleibt bis zum sicheren Nachweis notwendig. Volle Echtzeit inklusive Feld und Startzeit braucht weiterhin einen eventweiten Live-Feed von DBV/Tournamentsoftware oder abgestimmter Badhub-Schnittstelle.
