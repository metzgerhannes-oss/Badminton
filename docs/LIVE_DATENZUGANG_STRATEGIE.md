# Echter Live-Zugang für Schmetterlinge – Quellenprüfung 10.10.2026

Ziel: Matchzeiten, Feld, Gegner, Zwischen- und Satzstände sowie vollständige historische Einzelmatches im eigenen Supabase-Datenmodell, ohne Ergebnisse zu schätzen.

## Bereits tatsächlich erreichbarer Weg: Badhub Turniertag-Live

- https://badhub.de/spieler/05-061350/live → am 10.10.2026 von unserem Supabase-Server mit **HTTP 200**, Titel „Sarah Storz – Turniertag live – Badhub“ abgerufen.
- https://badhub.de/spieler/05-070879/live → **HTTP 200**, Titel „Philipp Metzger – Turniertag live – Badhub“.
- **Jetzt produktiv in der App:** Unter Turniere, Spielplan & Live-Ergebnisse: Spielerbezogene Schaltflächen **„Turniertag öffnen“** und **„Alle bisherigen Ergebnisse“**. Auch für neu gefolgte Spieler mit numerischer DBV-ID wird der öffentliche Badhub-Link aufgebaut. Das Vorhandensein der Seite bedeutet nicht, dass am aktuellen Tag eine Begegnung läuft.
- Badhub gibt öffentlich bereits individuelle Turnier- und Ligaergebnisse zurück; die direkte Nutzung als verlinkte Originalquelle ist etwas anderes als massenhafter Reimport und Weiterveröffentlichung.

## Öffentliche, aber von uns noch nicht nutzbare Live-/Daten-APIs

1. **nuLiga / nuPortalRS** – Dokumentation https://badde-portal.liga.nu/rs/documentation/ ; offizieller Backend-REST-Zugriff auf Verbands-/Ligasysteme. Der Test vom produktiven Supabase-Server gegen einen dokumentierten GET-Endpunkt ergab **HTTP 401: `No access token provided and no valid ip address`**. Die API ist deshalb nicht frei für unsere Supabase-IP nutzbar; ein Zugangstoken oder eine Freischaltung müsste autorisiert bereitgestellt werden. Nicht versuchen, die Sperre mit Web-Scraping oder fremden Tokens zu umgehen.
2. **DBV Turnierportal / Tournamentsoftware** – https://dbv.turnier.de/ ist offizieller öffentlicher Live-/Turnierbereich, aber keine frei dokumentierte Entwickler-Schnittstelle für Matchlisten ist bestätigt. Technischer Ansprechpartner DBV-Turnierkalender: **dominik.meyer@badminton.de** (https://turniere.badminton.de/imprint); Turnierportal-/Jugend-Wettkampffragen: **jws@badminton.de**. Plattformkontakt Visual Reality: **info@tournamentsoftware.com** (https://www.tournamentsoftware.com/contact.aspx).
3. **Badhub-Kooperation** – https://badhub.de/ führt mehr als 2,29 Mio. Matches und ca. 833.985 Turnierspiele zusammen. Betreiber/Ansprechpartner Christian Plunze; offizieller Feedbackkanal https://feedback.badhub.de/. Wir sollten einen **kleinen DBV-ID-bezogenen Read-only-Datenfeed** statt vollständigem Datenbankexport anfragen: `/players/{dbv_id}/matches?updated_since=…` und `/players/{dbv_id}/live`, inklusive Match-ID, Turnierlink, Seite, Spieler, Datum, Disziplin, Satzständen, Gewinner und Walkover.
4. **Parse.bot als unabhängige API** – https://parse.bot/marketplace/1df28c53-bf89-4024-ac08-c00255797d23/dbv-turnier-de-api ; `get_player` liefert Spieler-Career-Win/Loss für Einzel, Doppel, Mixed und laufendes Jahr. Das ist **kein DBV-offizieller Datenfeed**, benötigt einen eigenen API-Schlüssel/ggf. Credits und bietet aktuell keine vollständigen individuellen Matchlisten oder tagesgenaue Live-Felder. Daher höchstens als optionaler, klar gekennzeichneter Karriere-Statistik-Fallback und niemals als vollständig verifizierter DBV-Matchimport.

## Technische Live-Architektur nach Zugang

1. On-demand nur für DBV-IDs eigener/gefolgter Spieler, zentral in `player_history_imports`. Poll alle 30–60 Sekunden **nur an einem laufenden Turniertag**; außerhalb höchstens täglich. Einmalige Quelleabfragen gemeinsam cachen.
2. Connectoren: `nuLiga-league` für Mannschaftsspiele, `dbv-tournament` bzw. genehmigter `badhub-datafeed` für Turniere, `badhub-deeplink` als heutiger Fallback. Zugangstoken ausschließlich Supabase Secret/Edge Function oder serverseitiger Umgebung, nie JavaScript-GitHub-Pages.
3. Rohquellenbeleg + unveränderliche Provider-Match-ID, idempotente Upserts in `tournaments`, `events`, `matches`, `match_participants`, `match_games` bei belegtem Sieger/Status. `walkover`/`cancelled` nicht als gespieltes Match zählen.
4. Spielerprofil **05-061350 Sarah Storz** als Abnahmegegenprobe: bei einem freigeschalteten Datensatz Trefferzahl, Spielpaarungen und W/L getrennt nach Liga/Turnier gegen den öffentlichen Quellenausweis prüfen. Keine doppelte Zählung identischer Begegnungen aus Badhub und DBV.
5. Status klar trennen: Quelle aktuell + Beleg vorhanden, Quelle verspätet, externe Karrierestatistik, noch kein Matchimport; keine „Live“-Farbe oder erfundenen Zeiten ohne tatsächliches Ergebnis.

## Kreative No-API-Alternativen bis zur Freigabe

- **Turniertag-Link und QR:** Den Badhub-/DBV-Live-Link auf einem QR-Code für Eltern/Trainer bereitstellen, der mit dem ausgewählten Spieler verknüpft ist. Heute bereits als Deep-Link umgesetzt; ein QR-Code ist erst sinnvoll, wenn eine offizielle Veranstaltung ihn freigibt.
- **Veranstalter-Datenspende:** Ein Veranstalter kann seine freigegebenen Ergebnisdateien aus dem Tournament Planner (CSV/Excel/XML, falls exportierbar) nach Turnierende zur sicheren serverseitigen Prüfung bereitstellen. Kein Screenshot-/OCR-Massencrawling, da Fehler bei Satz-/Siegerzuordnung für unsere Fachlogik ausgeschlossen werden müssen.
- **Community-Reporter:** Vereinsinterne freiwillige Turnierbeobachter melden höchstens Hinweise (Feld/Startmeldung), gekennzeichnet „unbestätigt“. Ein offizielles Ergebnis wird erst nach Originalbeleg übernommen. Für gemeinsame Live-Meldungen brauchen wir Berechtigungen/Moderation.

## Konkreter Zugangsantrag (noch nicht verschickt)

Benötigte Fragen an Badhub/DBV: `1` Können wir für DBV-IDs einzelner abonnierter Spieler die öffentlichen Match- und Livetagsdaten per Read-only JSON abrufen? `2` Welche Nutzungs-/Caching-/Weiteranzeigerechte bestehen? `3` Welche IDs unterscheiden Badhub, nuLiga und Tournamentsoftware; wie werden Personen zugeordnet? `4` Welche Aktualisierungsintervalle/Ratenlimits gelten? `5` Gibt es eine kostenfreie Vereinskondition/Pilot für Jugend-Badminton? `6` Können Turnierorganisatoren alternativ einen signierten Export oder Webhook freigeben?

Erst nach schriftlich/technisch bestätigtem Zugriff eine produktive API-Integration aktivieren. Deep-Links sind bereits nutzbar, die Datenautomatik bleibt bis dahin bewusst auf freigegebene Quellen beschränkt.
